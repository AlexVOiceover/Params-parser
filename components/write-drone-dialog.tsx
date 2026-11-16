"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Usb, X, AlertTriangle } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { useDroneParams } from "@/lib/drone-params-context";
import { writeVerified, type WriteOutcome } from "@/lib/drone-flash-engine";

type Stage = "confirm" | "running" | "done" | "error";

export interface WriteChange { name: string; value: number; }

interface Props {
  changes: WriteChange[];
  onClose: () => void;
  /** Called whenever anything was written, with the read-back state to merge into the snapshot. */
  onSuccess: (outcome: WriteOutcome) => void;
  /** Replaces the plain verified write, e.g. to apply and log a version. */
  onStart?: (addLog: (msg: string) => void) => Promise<WriteOutcome>;
  /** Shown above the list; the write button stays disabled until it is acknowledged. */
  firmwareWarning?: string;
  /** Informational note shown above the list. */
  notice?: string;
}

export function WriteDroneDialog({ changes, onClose, onSuccess, onStart, firmwareWarning, notice }: Props) {
  const { droneParams } = useDroneParams();
  const [stage, setStage] = useState<Stage>("confirm");
  const [log, setLog] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<WriteOutcome | null>(null);
  const [acknowledged, setAcknowledged] = useState(!firmwareWarning);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const addLog = useCallback((msg: string) => setLog((prev) => [...prev, msg]), []);

  const start = useCallback(async () => {
    setStage("running");
    setLog([]);
    setError("");
    setOutcome(null);

    const result = onStart
      ? await onStart(addLog)
      : await writeVerified(changes, droneParams ?? [], addLog);
    setOutcome(result);
    if (result.results.length > 0) onSuccess(result);

    if (result.results.length === 0 && !result.ok) {
      setError(result.error ?? "Write failed — check the connection and retry.");
      setStage("error");
    } else {
      if (result.error) setError(result.error);
      setStage("done");
    }
  }, [changes, droneParams, onStart, onSuccess, addLog]);

  const busy = stage === "running";
  const failed = outcome?.results.filter((r) => !r.success) ?? [];
  const verified = (outcome?.results.length ?? 0) - failed.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={!busy ? onClose : undefined}
      />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Usb className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <h2 className="text-sm font-bold text-foreground">Write to drone</h2>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {stage === "confirm" && (
            <>
              {notice && (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 leading-relaxed">
                  {notice}
                </p>
              )}
              {firmwareWarning && (
                <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 flex flex-col gap-2">
                  <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{firmwareWarning}</p>
                  <label htmlFor="fw-ack" className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                    <input
                      id="fw-ack"
                      type="checkbox"
                      checked={acknowledged}
                      onChange={(e) => setAcknowledged(e.target.checked)}
                      className="cursor-pointer"
                    />
                    I understand — write anyway
                  </label>
                </div>
              )}
              <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-foreground leading-relaxed">
                  About to write <span className="font-semibold">{changes.length}</span> param{changes.length === 1 ? "" : "s"} to the drone.
                  Each one is read back to confirm it took. Make sure the drone is safe (disarmed, no props).
                </p>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-secondary/30 divide-y divide-border">
                {changes.map((c) => (
                  <div key={c.name} className="flex items-center justify-between px-3 py-1.5">
                    <span className="font-mono text-xs text-foreground truncate">{c.name}</span>
                    <span className="font-mono text-xs text-amber-700 dark:text-amber-300">{c.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {stage === "done" && (
            <div className="flex flex-col gap-1">
              <p className={`text-xs ${failed.length > 0 || error ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-400"}`}>
                ✓ {verified} verified{failed.length > 0 ? ` · ⚠ ${failed.length} did not take` : ""}
              </p>
              {failed.length > 0 && (
                <ul className="text-[11px] font-mono text-amber-700 dark:text-amber-300 flex flex-col gap-0.5">
                  {failed.map((f) => <li key={f.name}>{f.name}: {f.error}</li>)}
                </ul>
              )}
              {error && <p className="text-xs text-amber-700 dark:text-amber-300">{error}</p>}
            </div>
          )}

          {stage === "error" && (
            <p className="text-xs text-rose-700 dark:text-rose-300">{error}</p>
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

        <div className="flex items-center justify-end gap-2 border-t border-border bg-toolbar px-5 py-3">
          {!busy && stage !== "done" && (
            <button
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
          )}
          {(stage === "confirm" || stage === "running" || stage === "error") && (
            <BusyButton
              busy={busy}
              busyLabel="Writing and verifying…"
              icon={<Usb className="h-3.5 w-3.5" />}
              onClick={start}
              disabled={!acknowledged}
              className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {stage === "error" ? "Retry" : `Write ${changes.length} param${changes.length === 1 ? "" : "s"}`}
            </BusyButton>
          )}
          {stage === "done" && (
            <button
              onClick={onClose}
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
