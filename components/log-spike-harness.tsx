"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Usb, Gauge, Plug } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { requestDronePort } from "@/lib/serial-shim";
import { useSerialMode } from "@/lib/use-serial-mode";
import { openLogSession, type LogSession, type TransferMetrics } from "@/lib/mavlink-log";
import type { LogEntry, SerialPort } from "@/lib/mavlink-serial";

const BAUD_RATE = 115200;

const LIMITS: { label: string; bytes: number }[] = [
  { label: "256 KB", bytes: 256 * 1024 },
  { label: "1 MB", bytes: 1024 * 1024 },
  { label: "4 MB", bytes: 4 * 1024 * 1024 },
];

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

function formatUtc(seconds: number): string {
  if (!seconds) return "—";
  return new Date(seconds * 1000).toISOString().slice(0, 16).replace("T", " ");
}

export function LogSpikeHarness() {
  const serialMode = useSerialMode();
  const sessionRef = useRef<LogSession | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [listing, setListing] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [measuringId, setMeasuringId] = useState<number | null>(null);
  const [progressBytes, setProgressBytes] = useState(0);
  const [limitBytes, setLimitBytes] = useState(LIMITS[1].bytes);
  const [metrics, setMetrics] = useState<TransferMetrics | null>(null);
  const [error, setError] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const appendLog = useCallback((msg: string) => {
    setLog((prev) => [...prev, msg]);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: "end" });
  }, [log]);

  // Close the port if the operator navigates away mid-session.
  useEffect(() => {
    return () => { void sessionRef.current?.close(); };
  }, []);

  const connect = useCallback(async () => {
    setError("");
    setConnecting(true);
    try {
      const port = await requestDronePort() as SerialPort;
      const session = await openLogSession(port, BAUD_RATE, { onLog: appendLog });
      sessionRef.current = session;
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }, [appendLog]);

  const listLogs = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) return;
    setError("");
    setListing(true);
    setEntries([]);
    try {
      setEntries(await session.entries());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setListing(false);
    }
  }, []);

  const measure = useCallback(async (entry: LogEntry) => {
    const session = sessionRef.current;
    if (!session) return;
    setError("");
    setMetrics(null);
    setProgressBytes(0);
    setMeasuringId(entry.id);
    appendLog(`Measuring log ${entry.id} — up to ${formatBytes(Math.min(limitBytes, entry.size || limitBytes))}…`);
    try {
      const result = await session.measure(entry.id, entry.size, limitBytes, setProgressBytes);
      setMetrics(result);
      appendLog(`Done: ${formatBytes(result.bytes)} in ${result.seconds.toFixed(1)}s = ${result.kbPerSec.toFixed(1)} KB/s`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMeasuringId(null);
    }
  }, [appendLog, limitBytes]);

  const disconnect = useCallback(async () => {
    await sessionRef.current?.close();
    sessionRef.current = null;
    setConnected(false);
    setEntries([]);
    appendLog("Port closed");
  }, [appendLog]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        {!connected ? (
          <BusyButton
            busy={connecting}
            busyLabel="Connecting…"
            icon={<Usb className="h-4 w-4" />}
            onClick={connect}
            disabled={serialMode === "unsupported"}
            className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90"
          >
            Connect drone
          </BusyButton>
        ) : (
          <>
            <BusyButton
              busy={listing}
              busyLabel="Listing…"
              icon={<Gauge className="h-4 w-4" />}
              onClick={listLogs}
              className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90"
            >
              List logs
            </BusyButton>
            <BusyButton
              icon={<Plug className="h-4 w-4" />}
              onClick={disconnect}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
            >
              Disconnect
            </BusyButton>
          </>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <label htmlFor="limit" className="text-xs text-muted-foreground whitespace-nowrap">Transfer limit</label>
          <select
            id="limit"
            value={limitBytes}
            onChange={(e) => setLimitBytes(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-2 py-1.5 text-sm cursor-pointer"
          >
            {LIMITS.map((l) => <option key={l.bytes} value={l.bytes}>{l.label}</option>)}
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Serial transport: <span className="font-mono text-foreground">{serialMode}</span>
        {serialMode === "polyfill" && " (Android WebUSB compatibility mode)"}
        {serialMode === "unsupported" && " — needs Chrome on Android, Windows, macOS or Linux"}
      </p>

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {entries.length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Log</th>
                <th className="text-left px-3 py-2 font-medium">Size</th>
                <th className="text-left px-3 py-2 font-medium">Date (UTC)</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono">{entry.id}</td>
                  <td className="px-3 py-2">{formatBytes(entry.size)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatUtc(entry.timeUtc)}</td>
                  <td className="px-3 py-2 text-right">
                    <BusyButton
                      busy={measuringId === entry.id}
                      busyLabel={`${formatBytes(progressBytes)}…`}
                      onClick={() => measure(entry)}
                      disabled={measuringId !== null}
                      className="rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-secondary"
                    >
                      Measure
                    </BusyButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {metrics && (
        <div className="rounded-md border border-border bg-secondary/30 px-4 py-3">
          <p className="text-xs text-muted-foreground mb-2">Result</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-sm">
            <div><span className="text-muted-foreground">Throughput</span><br /><span className="text-lg font-semibold">{metrics.kbPerSec.toFixed(1)} KB/s</span></div>
            <div><span className="text-muted-foreground">Transferred</span><br />{formatBytes(metrics.bytes)}</div>
            <div><span className="text-muted-foreground">Elapsed</span><br />{metrics.seconds.toFixed(1)}s</div>
            <div><span className="text-muted-foreground">LOG_DATA frames</span><br />{metrics.frames}</div>
            <div><span className="text-muted-foreground">Retries</span><br />{metrics.retries}</div>
            <div><span className="text-muted-foreground">Transport</span><br /><span className="font-mono text-xs">{metrics.serialMode}</span></div>
          </div>
          {metrics.truncated && (
            <p className="text-xs text-muted-foreground mt-3">
              Stopped at the transfer limit — the full log is larger.
            </p>
          )}
        </div>
      )}

      {log.length > 0 && (
        <div className="rounded-md border border-border bg-background">
          <p className="text-xs text-muted-foreground px-3 py-2 border-b border-border">Session log</p>
          <div className="max-h-56 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
            {log.map((line, i) => <div key={i} className="text-muted-foreground">{line}</div>)}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
