"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Usb, X, AlertTriangle } from "lucide-react";
import { writeDroneParams, type ParamWriteResult } from "@/lib/mavlink-serial";
import type { FlashResult } from "@/lib/drone-flash-engine";

const BAUD_RATE = 115200;

type Stage = "confirm" | "running" | "done" | "error";

export interface WriteChange { name: string; value: number; }

interface Props {
  changes: WriteChange[];
  onClose: () => void;
  /** Called with successful writes so parent can merge updated values into context. */
  onSuccess: (written: ParamWriteResult[]) => void;
  /**
   * When provided, called instead of the built-in single-pass write.
   * The parent drives the write (e.g. via flashParamsToDrone) and resolves
   * with a FlashResult. Log messages should be pushed via the returned addLog.
   */
  onStart?: (addLog: (msg: string) => void) => Promise<FlashResult>;
}

export function WriteDroneDialog({ changes, onClose, onSuccess, onStart }: Props) {
  const [stage, setStage] = useState<Stage>("confirm");
  const [log, setLog] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ParamWriteResult[]>([]);
  const disconnectRef = useRef<(() => void) | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  function addLog(msg: string) { setLog((prev) => [...prev, msg]); }

  const start = useCallback(async () => {
    setStage("running");
    setLog([]);
    setError("");
    setProgress(0);
    setResults([]);

    if (onStart) {
      const flashResult = await onStart(addLog);
      if (flashResult.ok) {
        setStage("done");
        // Synthesise a ParamWriteResult array from the changes so onSuccess
        // receives the full written set for droneParams context update.
        const written: ParamWriteResult[] = changes.map((c) => ({
          name: c.name,
          requested: c.value,
          actual: c.value,
          success: true,
        }));
        onSuccess(written);
      } else {
        if (flashResult.reverted) {
          setError("Flash failed after max passes — reverted to previous state.");
        } else if (flashResult.unresolved.length > 0) {
          setError(`${flashResult.unresolved.length} param${flashResult.unresolved.length === 1 ? "" : "s"} could not be written: ${flashResult.unresolved.join(", ")}`);
        } else {
          setError("Flash failed — check connection and retry.");
        }
        setStage("error");
      }
      return;
    }

    const disconnect = await writeDroneParams(BAUD_RATE, changes, {
      onLog: addLog,
      onProgress(done) { setProgress(done); },
      onDone(r) {
        disconnectRef.current = null;
        setResults(r);
        setStage("done");
        const ok = r.filter((x) => x.success);
        if (ok.length > 0) onSuccess(ok);
      },
      onError(msg) {
        disconnectRef.current = null;
        setError(msg);
        setStage("error");
        addLog(`✗ ${msg}`);
      },
    });
    disconnectRef.current = disconnect;
  }, [changes, onSuccess, onStart]);

  function handleClose() {
    disconnectRef.current?.();
    onClose();
  }

  const busy = stage === "running";
  const successCount = results.filter((r) => r.success).length;
  const failCount = results.length - successCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={!busy ? handleClose : undefined}
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Usb className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <h2 className="text-sm font-bold text-foreground">Write to drone</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={busy}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {stage === "confirm" && (
            <>
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-foreground leading-relaxed">
                  About to write <span className="font-semibold">{changes.length}</span> param{changes.length === 1 ? "" : "s"} to the drone.
                  This modifies live configuration. Make sure the drone is safe (disarmed, no props).
                </p>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-secondary/30 divide-y divide-border">
                {changes.filter((c) => c.name !== "SCR_USER2").map((c) => (
                  <div key={c.name} className="flex items-center justify-between px-3 py-1.5">
                    <span className="font-mono text-xs text-foreground truncate">{c.name}</span>
                    <span className="font-mono text-xs text-amber-700 dark:text-amber-300">{c.value}</span>
                  </div>
                ))}
                {/* SCR_USER2 is the version marker — shown separately so it's not confused with a config change */}
                {changes.some((c) => c.name === "SCR_USER2") && (
                  <div className="flex items-center justify-between px-3 py-1.5 opacity-50">
                    <span className="font-mono text-xs text-muted-foreground">SCR_USER2 (version marker)</span>
                    <span className="font-mono text-xs text-muted-foreground">{changes.find((c) => c.name === "SCR_USER2")?.value}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {stage === "running" && (
            <div className="flex flex-col gap-1.5">
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all duration-150"
                  style={{ width: `${changes.length ? (progress / changes.length) * 100 : 0}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right">
                {progress} / {changes.length} written
              </p>
            </div>
          )}

          {stage === "done" && (
            <p className={`text-xs ${failCount > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-400"}`}>
              ✓ {successCount} written{failCount > 0 ? ` · ⚠ ${failCount} failed` : ""}
            </p>
          )}

          {log.length > 0 && (
            <div className="rounded-md border border-border bg-black/30 dark:bg-black/30 px-3 py-2 max-h-44 overflow-y-auto flex flex-col gap-0.5">
              {log.map((line, i) => (
                <p
                  key={i}
                  className={`font-mono text-[11px] leading-relaxed ${
                    line.startsWith("✗") || line.startsWith("⚠")
                      ? "text-amber-700 dark:text-amber-400"
                      : line.startsWith("✓")
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }`}
                >
                  <span className="text-muted-foreground/40 mr-1.5">›</span>{line}
                </p>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border bg-toolbar px-5 py-3">
          {!busy && stage !== "done" && (
            <button
              onClick={handleClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
          )}
          {stage === "confirm" && (
            <button
              onClick={start}
              className="flex items-center gap-1.5 rounded-md bg-amber-500 dark:bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Usb className="h-3.5 w-3.5" />
              Write {changes.length} param{changes.length === 1 ? "" : "s"}
            </button>
          )}
          {stage === "error" && (
            <button
              onClick={start}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Usb className="h-3.5 w-3.5" />
              Retry
            </button>
          )}
          {stage === "done" && (
            <button
              onClick={handleClose}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
