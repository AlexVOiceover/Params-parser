// MAVLink v1+v2 browser serial connection for ArduPilot parameter reading.
// Frame parsing modelled after ArduPilot/node-mavlink (MIT).

import { requestDronePort, getGrantedDronePorts } from "@/lib/serial-shim";

// ── CRC_EXTRA (magic numbers) ─────────────────────────────────────────────────
// Full common + ardupilotmega table subset — covers all messages ArduPilot
// regularly streams so we can validate and detect frames correctly.
const CRC_EXTRA: Record<number, number> = {
  0:   50,  // HEARTBEAT
  1:  124,  // SYS_STATUS
  2:  137,  // SYSTEM_TIME
  20: 214,  // PARAM_REQUEST_READ
  21: 159,  // PARAM_REQUEST_LIST
  22: 220,  // PARAM_VALUE
  23: 168,  // PARAM_SET
  24:  24,  // GPS_RAW_INT
  25: 185,  // GPS_STATUS
  26: 208,  // SCALED_IMU
  27:  24,  // RAW_IMU
  28:  52,  // RAW_PRESSURE
  29: 255,  // SCALED_PRESSURE
  30:  39,  // ATTITUDE
  31: 246,  // ATTITUDE_QUATERNION
  32: 185,  // LOCAL_POSITION_NED
  33: 104,  // GLOBAL_POSITION_INT
  34:  84,  // RC_CHANNELS_SCALED
  35: 124,  // RC_CHANNELS_RAW
  36:  27,  // SERVO_OUTPUT_RAW
  42: 184,  // MISSION_CURRENT
  62: 183,  // NAV_CONTROLLER_OUTPUT
  65: 118,  // RC_CHANNELS
  74:  20,  // VFR_HUD
  77: 143,  // COMMAND_ACK
  105: 93,  // HIGHRES_IMU
  116: 76,  // SCALED_IMU2
  125:  38, // POWER_STATUS
  147: 154, // BATTERY_STATUS
  163: 127, // AHRS
  165:  27, // HWSTATUS
  166:  59, // RADIO
  168: 167, // WIND
  173:  98, // RANGEFINDER
  178: 200, // AHRS2
  183:  42, // MAG_CAL_PROGRESS
  191:  29, // SENSOR_OFFSETS
  193:  71, // EKF_STATUS_REPORT
  222:  93, // AUTOPILOT_VERSION
  226:  19, // EFI_STATUS
  241:  90, // VIBRATION
  242:  15, // HOME_POSITION
  245: 227, // EXTENDED_SYS_STATE
  246: 183, // ADSB_VEHICLE
  253:  83, // STATUSTEXT
  269: 205, // UAVCAN_NODE_STATUS
};

const STX_V1 = 0xfe;
const STX_V2 = 0xfd;
const SIGN_LEN = 13; // bytes added to v2 signed frames

const SYS_ID  = 255;
const COMP_ID = 190;
const TARGET_SYS  = 1;
const TARGET_COMP = 1;

// ── CRC-16/MCRF4XX ────────────────────────────────────────────────────────────

function crcAccum(b: number, crc: number): number {
  let tmp = (b ^ (crc & 0xff)) & 0xff;
  tmp ^= (tmp << 4) & 0xff;
  return ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff;
}

function x25crc(buf: Uint8Array, start: number, trim: number, extra: number): number {
  let crc = 0xffff;
  for (let i = start; i < buf.length - trim; i++) crc = crcAccum(buf[i], crc);
  crc = crcAccum(extra, crc);
  return crc;
}

// ── Frame builder ─────────────────────────────────────────────────────────────

let seq = 0;

function buildV1(msgId: number, payload: Uint8Array): Uint8Array {
  const s = seq++ & 0xff;
  const len = payload.length;
  const frame = new Uint8Array(6 + len + 2);
  frame[0] = STX_V1; frame[1] = len; frame[2] = s;
  frame[3] = SYS_ID; frame[4] = COMP_ID; frame[5] = msgId;
  frame.set(payload, 6);
  const crc = x25crc(frame, 1, 2, CRC_EXTRA[msgId]);
  frame[6 + len]     = crc & 0xff;
  frame[6 + len + 1] = (crc >> 8) & 0xff;
  return frame;
}

function buildV2(msgId: number, payload: Uint8Array): Uint8Array {
  const s = seq++ & 0xff;
  const len = payload.length;
  const frame = new Uint8Array(10 + len + 2);
  frame[0] = STX_V2; frame[1] = len; frame[2] = 0; frame[3] = 0;
  frame[4] = s; frame[5] = SYS_ID; frame[6] = COMP_ID;
  frame[7] = msgId & 0xff; frame[8] = (msgId >> 8) & 0xff; frame[9] = (msgId >> 16) & 0xff;
  frame.set(payload, 10);
  const crc = x25crc(frame, 1, 2, CRC_EXTRA[msgId]);
  frame[10 + len]     = crc & 0xff;
  frame[10 + len + 1] = (crc >> 8) & 0xff;
  return frame;
}

export function buildParamRequestList(v1: boolean): Uint8Array {
  const p = new Uint8Array([TARGET_SYS, TARGET_COMP]);
  return v1 ? buildV1(21, p) : buildV2(21, p);
}

export function buildParamRequestRead(index: number, v1: boolean): Uint8Array {
  const p = new Uint8Array(20);
  p[0] = TARGET_SYS; p[1] = TARGET_COMP;
  p[18] = index & 0xff; p[19] = (index >> 8) & 0xff;
  return v1 ? buildV1(20, p) : buildV2(20, p);
}

// PARAM_SET wire layout (largest fields first):
//   [0-3]  param_value      float32
//   [4]    target_system    uint8
//   [5]    target_component uint8
//   [6-21] param_id         char[16]
//   [22]   param_type       uint8 (MAV_PARAM_TYPE: 9 = REAL32)
export function buildParamSet(name: string, value: number, v1: boolean): Uint8Array {
  const payload = new Uint8Array(23);
  const view = new DataView(payload.buffer);
  view.setFloat32(0, value, true);
  payload[4] = TARGET_SYS;
  payload[5] = TARGET_COMP;
  for (let i = 0; i < Math.min(16, name.length); i++) {
    payload[6 + i] = name.charCodeAt(i);
  }
  payload[22] = 9; // MAV_PARAM_TYPE_REAL32 — ArduPilot accepts this for all params
  return v1 ? buildV1(23, payload) : buildV2(23, payload);
}

// ── PARAM_VALUE parser ────────────────────────────────────────────────────────
// Wire layout (largest fields first):
//   [0-3]  param_value  float32
//   [4-5]  param_count  uint16
//   [6-7]  param_index  uint16
//   [8-23] param_id     char[16]
//   [24]   param_type   uint8

interface ParamValue { name: string; value: number; index: number; count: number; }

function parseParamValue(payload: Uint8Array): ParamValue | null {
  if (payload.length < 24) return null;
  const view = new DataView(payload.buffer, payload.byteOffset);
  const value = view.getFloat32(0, true);
  const count = view.getUint16(4, true);
  const index = view.getUint16(6, true);
  let name = "";
  for (let i = 8; i < Math.min(24, payload.length); i++) {
    if (payload[i] === 0) break;
    name += String.fromCharCode(payload[i]);
  }
  return { name, value, index, count };
}

// ── Packet splitter (mirrors node-mavlink MavLinkPacketSplitter) ─────────────

interface SplitterResult {
  params: ParamValue[];
  detectedVersion: 1 | 2 | null;
  validFrames: number;
}

class MavlinkSplitter {
  private buf = new Uint8Array(0);
  detectedVersion: 1 | 2 | null = null;
  crcMismatches = 0;
  firstMismatch: string | null = null;

  feed(chunk: Uint8Array): SplitterResult {
    // Append chunk to buffer
    const next = new Uint8Array(this.buf.length + chunk.length);
    next.set(this.buf); next.set(chunk, this.buf.length);
    this.buf = next;

    const params: ParamValue[] = [];
    let validFrames = 0;

    while (this.buf.length > 0) {
      // Find first STX
      let stxPos = -1;
      for (let i = 0; i < this.buf.length; i++) {
        if (this.buf[i] === STX_V1 || this.buf[i] === STX_V2) { stxPos = i; break; }
      }
      if (stxPos === -1) { this.buf = new Uint8Array(0); break; }
      if (stxPos > 0) this.buf = this.buf.slice(stxPos); // skip to STX

      const isV2 = this.buf[0] === STX_V2;
      const headerLen = isV2 ? 10 : 6;

      if (this.buf.length < headerLen) break; // need more data

      const payloadLen = this.buf[1];
      const signed = isV2 && (this.buf[2] & 0x01) !== 0;
      const frameLen = headerLen + payloadLen + 2 + (signed ? SIGN_LEN : 0);

      if (this.buf.length < frameLen) break; // need more data

      const frame = this.buf.slice(0, frameLen);
      const msgId = isV2
        ? frame[7] | (frame[8] << 8) | (frame[9] << 16)
        : frame[5];

      const extra = CRC_EXTRA[msgId];
      const crcTrim = 2 + (signed ? SIGN_LEN : 0);

      if (extra !== undefined) {
        const expected = x25crc(frame, 1, crcTrim, extra);
        const actual = frame[frameLen - crcTrim] | (frame[frameLen - crcTrim + 1] << 8);

        if (expected === actual) {
          this.crcMismatches = 0; // reset on success
          // Valid frame
          validFrames++;
          if (this.detectedVersion === null) this.detectedVersion = isV2 ? 2 : 1;

          if (msgId === 22) {
            const payload = frame.slice(headerLen, headerLen + payloadLen);
            const pv = parseParamValue(payload);
            if (pv) params.push(pv);
          }
          this.buf = this.buf.slice(frameLen);
        } else {
          // CRC mismatch — record first failure for diagnostics, advance 1 byte
          this.crcMismatches++;
          if (this.firstMismatch === null && this.crcMismatches <= 3) {
            this.firstMismatch = `v${isV2?2:1} msgId=${msgId} payLen=${payloadLen} expected=0x${expected.toString(16)} actual=0x${actual.toString(16)}`;
          }
          this.buf = this.buf.slice(1);
        }
      } else {
        // Unknown msgId — we can't verify the CRC, so we cannot trust this is a frame.
        // Skip the STX byte and look for a known message (like HEARTBEAT or PARAM_VALUE).
        this.buf = this.buf.slice(1);
      }
    }

    return { params, detectedVersion: this.detectedVersion, validFrames };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export type MavlinkCallbacks = {
  onProgress: (received: number, total: number) => void;
  onDone: (params: { name: string; value: string }[]) => void;
  onError: (msg: string) => void;
  onLog: (msg: string) => void;
};

interface SerialPortSignals { dataTerminalReady?: boolean; requestToSend?: boolean; }
interface SerialPort {
  open(options: { baudRate: number; bufferSize?: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  setSignals?(signals: SerialPortSignals): Promise<void>;
}

export async function openDroneConnection(
  baudRate: number,
  callbacks: MavlinkCallbacks
): Promise<() => void> {
  const { onProgress, onDone, onError, onLog } = callbacks;

  let port: SerialPort;
  try {
    port = await requestDronePort() as SerialPort;
  } catch (e) {
    onError(`No port selected: ${e instanceof Error ? e.message : String(e)}`);
    return () => {};
  }

  onLog(`Opening port at ${baudRate} baud…`);
  try {
    // Some boards/radios require DTR/RTS to be asserted to stream data
    await port.open({
      baudRate,
      bufferSize: 16 * 1024,
      // dataBits: 8, stopBits: 1, parity: "none" are defaults
    });
    // Trigger DTR/RTS
    await port.setSignals?.({ dataTerminalReady: true, requestToSend: true });
  } catch (e) {
    onError(`Failed to open port: ${e instanceof Error ? e.message : String(e)}`);
    return () => {};
  }
  onLog("Port open — listening for MAVLink…");

  const splitter = new MavlinkSplitter();
  const received = new Map<number, { name: string; value: string }>();
  let paramCount: number | null = null;
  let requestSent = false;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryCount = 0;
  let done = false;
  let totalBytes = 0;
  let versionLogged = false;
  let heartbeatCount = 0;
  let lastProgressLog = 0;

  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const writer = port.writable?.getWriter();
  let aborted = false;

  // Watchdog — diagnose stalled connections
  const watchdog = setInterval(() => {
    if (done) return;
    if (totalBytes === 0) {
      onLog("⚠ No data received — check connection and baud rate");
    } else if (!versionLogged) {
      const mismatchInfo = splitter.firstMismatch ? ` | First CRC fail: ${splitter.firstMismatch}` : '';
      onLog(`⚠ ${totalBytes} bytes received, no valid frames yet${mismatchInfo}`);
    }
  }, 5000);

  async function sendFrame(frame: Uint8Array) {
    if (!writer) return;
    await writer.write(frame);
  }

  async function closePort() {
    aborted = true;
    try { await reader?.cancel(); } catch {}
    try { writer?.releaseLock(); } catch {}
    try { await port.close(); } catch {}
  }

  function finish() {
    if (done) return;
    done = true;
    clearInterval(watchdog);
    if (retryTimer) clearTimeout(retryTimer);
    const params = Array.from(received.values());
    onLog(`Complete — ${params.length} params loaded`);
    onDone(params);
    // Release the port so subsequent writes can re-open it
    closePort();
  }

  function scheduleRetry() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(async () => {
      if (done || paramCount === null) return;
      const missing: number[] = [];
      for (let i = 0; i < paramCount; i++) { if (!received.has(i)) missing.push(i); }
      if (missing.length === 0) { finish(); return; }
      if (retryCount >= 5) {
        onLog(`⚠ Gave up — ${missing.length} params never arrived`);
        finish(); return;
      }
      retryCount++;
      const v1 = splitter.detectedVersion === 1;

      // If most params are missing, re-request the full list instead of individual reads
      if (missing.length > paramCount * 0.5) {
        onLog(`Re-requesting full param list (retry ${retryCount}/5, ${missing.length} missing)…`);
        await sendFrame(buildParamRequestList(v1));
      } else {
        // Request individually in batches of 50 to avoid flooding
        onLog(`Re-requesting ${missing.length} missing params (retry ${retryCount}/5)…`);
        for (let i = 0; i < missing.length; i++) {
          await sendFrame(buildParamRequestRead(missing[i], v1));
          if (i > 0 && i % 50 === 0) await new Promise(r => setTimeout(r, 200));
        }
      }
      scheduleRetry();
    }, 5000);
  }

  async function readLoop() {
    reader = port.readable!.getReader();
    try {
      while (!aborted) {
        const { done: sd, value } = await reader.read();
        if (sd || !value) break;

        totalBytes += value.length;

        // Log first bytes for diagnostics
        if (totalBytes <= value.length && value.length > 0) {
          const preview = Array.from(value.slice(0, 32)).map(b => b.toString(16).padStart(2,'0')).join(' ');
          onLog(`First bytes: ${preview}`);
        }

        const result = splitter.feed(value);

        if (result.validFrames > 0 && !versionLogged) {
          versionLogged = true;
          onLog(`MAVLink v${splitter.detectedVersion} detected — waiting for autopilot to be ready…`);
        }

        // Count heartbeats (msgId 0) to know autopilot is fully booted
        if (versionLogged && !requestSent) {
          heartbeatCount += result.validFrames;
          if (heartbeatCount >= 3) {
            onLog("Autopilot ready — sending PARAM_REQUEST_LIST…");
            await sendFrame(buildParamRequestList(splitter.detectedVersion === 1));
            requestSent = true;
            scheduleRetry();
          }
        }

        for (const pv of result.params) {
          if (paramCount === null && pv.count > 0) {
            paramCount = pv.count;
            onLog(`Drone has ${paramCount} parameters`);
          }
          if (!received.has(pv.index)) {
            received.set(pv.index, { name: pv.name, value: String(pv.value) });
            onProgress(received.size, paramCount ?? 0);
            const n = received.size;
            if (paramCount && n - lastProgressLog >= 100) {
              lastProgressLog = n;
              onLog(`${n} / ${paramCount} received…`);
            }
          }
          if (paramCount !== null && received.size >= paramCount) { finish(); return; }
          scheduleRetry();
        }
      }
    } catch {
      if (!done && !aborted) onError("Connection lost.");
    } finally {
      reader?.releaseLock();
    }
  }

  readLoop();

  // Fallback: send after 5s if heartbeat detection hasn't triggered yet
  setTimeout(async () => {
    if (done || requestSent) return;
    onLog("No heartbeats yet — sending PARAM_REQUEST_LIST anyway…");
    await sendFrame(buildParamRequestList(true));
    await sendFrame(buildParamRequestList(false));
    requestSent = true;
    scheduleRetry();
  }, 5000);

  return async function disconnect() {
    done = true;
    clearInterval(watchdog);
    if (retryTimer) clearTimeout(retryTimer);
    await closePort();
  };
}

// ── Write ─────────────────────────────────────────────────────────────────────

export interface ParamWriteChange { name: string; value: number; }

export interface ParamWriteResult {
  name: string;
  requested: number;
  actual?: number;
  success: boolean;
  error?: string;
}

export interface ParamWriteCallbacks {
  onProgress: (done: number, total: number, lastName: string) => void;
  onDone: (results: ParamWriteResult[]) => void;
  onError: (msg: string) => void;
  onLog: (msg: string) => void;
}

export async function writeDroneParams(
  baudRate: number,
  changes: ParamWriteChange[],
  callbacks: ParamWriteCallbacks
): Promise<() => void> {
  const { onProgress, onDone, onError, onLog } = callbacks;

  let port: SerialPort;
  try {
    // Try to reuse a previously-granted port (same session, already picked during read)
    const existing = await getGrantedDronePorts();
    if (existing.length === 1) {
      port = existing[0] as SerialPort;
      onLog("Reusing previously-granted port");
    } else {
      port = await requestDronePort() as SerialPort;
    }
  } catch (e) {
    onError(`No port selected: ${e instanceof Error ? e.message : String(e)}`);
    return () => {};
  }

  onLog(`Opening port at ${baudRate} baud…`);
  try {
    await port.open({ baudRate, bufferSize: 16 * 1024 });
    await port.setSignals?.({ dataTerminalReady: true, requestToSend: true });
  } catch (e) {
    onError(`Failed to open port: ${e instanceof Error ? e.message : String(e)}`);
    return () => {};
  }
  onLog("Port open — waiting for heartbeat…");

  const splitter = new MavlinkSplitter();
  const writer = port.writable?.getWriter();
  const results: ParamWriteResult[] = [];
  let aborted = false;
  let done = false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  // Promise/resolver for each PARAM_VALUE response
  const pending = new Map<string, (pv: { name: string; value: number }) => void>();

  async function sendFrame(frame: Uint8Array) {
    if (!writer) return;
    await writer.write(frame);
  }

  async function finish(errMsg?: string) {
    if (done) return;
    done = true;
    try { await reader?.cancel(); } catch {}
    try { writer?.releaseLock(); } catch {}
    try { await port.close(); } catch {}
    if (errMsg) { onError(errMsg); return; }
    onDone(results);
  }

  // Read loop — dispatches incoming PARAM_VALUE responses to waiting pending[] promises
  (async function readLoop() {
    try {
      reader = port.readable!.getReader();
      while (!aborted) {
        const { done: sd, value } = await reader.read();
        if (sd || !value) break;
        const result = splitter.feed(value);
        for (const pv of result.params) {
          const resolver = pending.get(pv.name);
          if (resolver) {
            pending.delete(pv.name);
            resolver({ name: pv.name, value: pv.value });
          }
        }
      }
    } catch {
      if (!done) onLog("⚠ Read loop ended unexpectedly");
    } finally {
      try { reader?.releaseLock(); } catch {}
    }
  })();

  // Wait briefly so MAVLink version is detected (and the FC is clearly alive)
  const waitForFrames = new Promise<void>((resolve) => {
    const start = Date.now();
    const poll = setInterval(() => {
      if (splitter.detectedVersion !== null || Date.now() - start > 5000) {
        clearInterval(poll);
        resolve();
      }
    }, 100);
  });
  await waitForFrames;

  if (splitter.detectedVersion === null) {
    onLog("⚠ No MAVLink frames detected — writing blind as v2");
  } else {
    onLog(`MAVLink v${splitter.detectedVersion} — writing ${changes.length} param${changes.length === 1 ? "" : "s"}…`);
  }
  const v1 = splitter.detectedVersion === 1;

  function waitFor(name: string, timeoutMs: number): Promise<{ name: string; value: number } | null> {
    return new Promise((resolve) => {
      pending.set(name, resolve);
      setTimeout(() => {
        if (pending.has(name)) {
          pending.delete(name);
          resolve(null);
        }
      }, timeoutMs);
    });
  }

  // Write each change sequentially; up to 3 attempts per param
  for (let i = 0; i < changes.length; i++) {
    if (aborted) break;
    const { name, value } = changes[i];

    let confirmed: { name: string; value: number } | null = null;
    for (let attempt = 0; attempt < 3 && !confirmed; attempt++) {
      const respPromise = waitFor(name, 2000);
      await sendFrame(buildParamSet(name, value, v1));
      confirmed = await respPromise;
      if (!confirmed && attempt < 2) await new Promise((r) => setTimeout(r, 200));
    }

    if (confirmed) {
      const ok = Math.abs(confirmed.value - value) < 1e-5;
      results.push({
        name,
        requested: value,
        actual: confirmed.value,
        success: ok,
        error: ok ? undefined : `returned ${confirmed.value}, expected ${value}`,
      });
      onLog(`${ok ? "✓" : "⚠"} ${name} = ${confirmed.value}${ok ? "" : ` (expected ${value})`}`);
    } else {
      results.push({ name, requested: value, success: false, error: "no confirmation" });
      onLog(`✗ ${name}: no confirmation after 3 tries`);
    }

    onProgress(i + 1, changes.length, name);
  }

  await finish();

  return async function disconnect() {
    aborted = true;
    await finish();
  };
}
