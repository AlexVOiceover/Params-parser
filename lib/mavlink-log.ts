// MAVLink dataflash log transfer — listing and throughput measurement.
//
// Reuses the frame builder, CRC and splitter from lib/mavlink-serial.ts. This
// module exists to answer one question: what sustained KB/s does a log
// transfer achieve on desktop versus Android-over-OTG? It deliberately does
// not keep the bytes it receives.
//
// Protocol constraints that shape the code (ArduPilot log-download docs):
//   • The vehicle must be disarmed, or ArduPilot replies with a
//     "Disarm for log download" STATUSTEXT and ignores the request.
//   • Only ONE LOG_REQUEST_DATA may be outstanding per link. Extras are
//     silently dropped while one is being serviced, so pipelining does not
//     work — every chunk costs a round trip.
//   • A zero-count LOG_DATA is NOT a reliable end-of-transfer signal. It only
//     arrives when the offset is already at/beyond the log size; a final chunk
//     that exactly fills the request produces no such message. Count bytes
//     against the LOG_ENTRY size instead.

import {
  buildV1,
  buildV2,
  MavlinkSplitter,
  type LogEntry,
  type LogChunk,
  type SerialPort,
} from "@/lib/mavlink-serial";
import { getSerialMode, type SerialMode } from "@/lib/serial-shim";

const TARGET_SYS = 1;
const TARGET_COMP = 1;

/** Bytes of log payload carried by a single LOG_DATA message. */
export const LOG_DATA_PAYLOAD = 90;

function buildFrame(msgId: number, payload: Uint8Array, v1: boolean): Uint8Array {
  return v1 ? buildV1(msgId, payload) : buildV2(msgId, payload);
}

// LOG_REQUEST_LIST (117), 6 bytes: start u16, end u16, target_system u8, target_component u8
export function buildLogRequestList(v1: boolean, start = 0, end = 0xffff): Uint8Array {
  const payload = new Uint8Array(6);
  const view = new DataView(payload.buffer);
  view.setUint16(0, start, true);
  view.setUint16(2, end, true);
  payload[4] = TARGET_SYS;
  payload[5] = TARGET_COMP;
  return buildFrame(117, payload, v1);
}

// LOG_REQUEST_DATA (119), 12 bytes: ofs u32, count u32, id u16, target_system u8, target_component u8
export function buildLogRequestData(id: number, ofs: number, count: number, v1: boolean): Uint8Array {
  const payload = new Uint8Array(12);
  const view = new DataView(payload.buffer);
  view.setUint32(0, ofs, true);
  view.setUint32(4, count, true);
  view.setUint16(8, id, true);
  payload[10] = TARGET_SYS;
  payload[11] = TARGET_COMP;
  return buildFrame(119, payload, v1);
}

// LOG_REQUEST_END (122), 2 bytes: target_system u8, target_component u8
export function buildLogRequestEnd(v1: boolean): Uint8Array {
  return buildFrame(122, new Uint8Array([TARGET_SYS, TARGET_COMP]), v1);
}

export interface LogSessionCallbacks {
  onLog: (msg: string) => void;
  onStatusText?: (text: string) => void;
}

export interface TransferMetrics {
  bytes: number;
  seconds: number;
  kbPerSec: number;
  frames: number;
  retries: number;
  serialMode: SerialMode;
  /** True when the transfer stopped because the byte limit was reached. */
  truncated: boolean;
}

/**
 * An open MAVLink log session. Holds the port, the read loop and the detected
 * protocol version, so listing and measuring share one connection.
 */
export interface LogSession {
  entries(): Promise<LogEntry[]>;
  measure(id: number, logSize: number, byteLimit: number, onProgress: (bytes: number) => void): Promise<TransferMetrics>;
  close(): Promise<void>;
}

export async function openLogSession(
  port: SerialPort,
  baudRate: number,
  callbacks: LogSessionCallbacks
): Promise<LogSession> {
  const { onLog, onStatusText } = callbacks;

  onLog(`Opening port at ${baudRate} baud…`);
  await port.open({ baudRate, bufferSize: 16 * 1024 });
  await port.setSignals?.({ dataTerminalReady: true, requestToSend: true });
  onLog("Port open — waiting for heartbeat…");

  const splitter = new MavlinkSplitter();
  const writer = port.writable?.getWriter();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let aborted = false;

  const entryBuffer: LogEntry[] = [];
  const sink: { fn: ((chunk: LogChunk) => void) | null } = { fn: null };

  (async function readLoop() {
    try {
      reader = port.readable!.getReader();
      while (!aborted) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        const result = splitter.feed(value);
        for (const entry of result.logEntries) entryBuffer.push(entry);
        const onChunk = sink.fn;
        if (onChunk) {
          for (const chunk of result.logData) onChunk(chunk);
        }
        for (const text of result.statusTexts) {
          onLog(`FC: ${text}`);
          onStatusText?.(text);
        }
      }
    } catch {
      if (!aborted) onLog("⚠ Read loop ended unexpectedly");
    } finally {
      try { reader?.releaseLock(); } catch {}
    }
  })();

  // Wait for a frame so we know whether to speak v1 or v2.
  await new Promise<void>((resolve) => {
    const start = Date.now();
    const poll = setInterval(() => {
      if (splitter.detectedVersion !== null || Date.now() - start > 5000) {
        clearInterval(poll);
        resolve();
      }
    }, 100);
  });

  if (splitter.detectedVersion === null) {
    onLog("⚠ No MAVLink frames detected — requesting blind as v2");
  } else {
    onLog(`MAVLink v${splitter.detectedVersion} detected`);
  }
  const v1 = splitter.detectedVersion === 1;

  async function send(frame: Uint8Array): Promise<void> {
    if (!writer) throw new Error("Port is not writable");
    await writer.write(frame);
  }

  return {
    async entries(): Promise<LogEntry[]> {
      entryBuffer.length = 0;
      onLog("Requesting log list…");
      await send(buildLogRequestList(v1));

      // Collect until num_logs entries have arrived, or the stream goes quiet.
      const started = Date.now();
      let lastCount = 0;
      let quietSince = Date.now();
      for (;;) {
        await new Promise((r) => setTimeout(r, 200));
        if (entryBuffer.length !== lastCount) {
          lastCount = entryBuffer.length;
          quietSince = Date.now();
        }
        const expected = entryBuffer[0]?.numLogs ?? 0;
        if (expected > 0 && entryBuffer.length >= expected) break;
        // No logs on board: ArduPilot sends a single entry with num_logs 0.
        if (entryBuffer.length > 0 && expected === 0) break;
        if (Date.now() - quietSince > 2000) break;
        if (Date.now() - started > 15000) {
          onLog("⚠ Timed out waiting for the log list");
          break;
        }
      }

      const unique = new Map<number, LogEntry>();
      for (const e of entryBuffer) unique.set(e.id, e);
      const list = [...unique.values()].sort((a, b) => a.id - b.id);
      onLog(`${list.length} log${list.length === 1 ? "" : "s"} listed`);
      return list;
    },

    async measure(id, logSize, byteLimit, onProgress): Promise<TransferMetrics> {
      const target = logSize > 0 ? Math.min(byteLimit, logSize) : byteLimit;
      // Ask for a window per round trip; ArduPilot answers with as many
      // 90-byte LOG_DATA messages as it takes to fill it.
      const WINDOW = LOG_DATA_PAYLOAD * 10;
      const REQUEST_TIMEOUT_MS = 3000;

      let bytes = 0;
      let frames = 0;
      let retries = 0;
      let ofs = 0;
      const startedAt = performance.now();

      while (bytes < target) {
        const want = Math.min(WINDOW, target - bytes);
        let windowBytes = 0;
        let settled = false;

        await new Promise<void>((resolve) => {
          const finish = () => {
            if (settled) return;
            settled = true;
            sink.fn = null;
            clearTimeout(timer);
            resolve();
          };
          const timer = setTimeout(finish, REQUEST_TIMEOUT_MS);

          sink.fn = (chunk: LogChunk) => {
            if (chunk.id !== id) return;
            frames++;
            // count === 0 means the offset is at/beyond the end of the log.
            if (chunk.count === 0) { finish(); return; }
            windowBytes += chunk.data.length;
            bytes += chunk.data.length;
            onProgress(bytes);
            // Bytes are deliberately discarded — measuring is the point.
            if (windowBytes >= want) finish();
          };

          void send(buildLogRequestData(id, ofs, want, v1)).catch(finish);
        });

        if (windowBytes === 0) {
          retries++;
          if (retries > 5) {
            onLog(`⚠ Giving up after ${retries} empty responses at offset ${ofs}`);
            break;
          }
          onLog(`⚠ No data at offset ${ofs} — re-requesting (${retries}/5)`);
          continue;
        }

        retries = 0;
        ofs += windowBytes;
      }

      const seconds = (performance.now() - startedAt) / 1000;
      // Abort any transfer still in flight so the next measurement starts clean.
      try { await send(buildLogRequestEnd(v1)); } catch {}

      return {
        bytes,
        seconds,
        kbPerSec: seconds > 0 ? bytes / 1024 / seconds : 0,
        frames,
        retries,
        serialMode: getSerialMode(),
        truncated: logSize > byteLimit,
      };
    },

    async close(): Promise<void> {
      aborted = true;
      sink.fn = null;
      try { await reader?.cancel(); } catch {}
      try { writer?.releaseLock(); } catch {}
      try { await port.close(); } catch {}
    },
  };
}
