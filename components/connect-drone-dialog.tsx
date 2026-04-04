"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Usb, X } from "lucide-react";
import { openDroneConnection } from "@/lib/mavlink-serial";
import type { Param } from "@/lib/types";

const BAUD_RATE = 115200;

type Stage = "idle" | "running" | "done" | "error";

interface Props {
  onParamsLoaded: (params: Param[]) => void;
  onClose: () => void;
}

export function ConnectDroneDialog({ onParamsLoaded, onClose }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [received, setReceived] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const disconnectRef = useRef<(() => void) | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  function addLog(msg: string) {
    setLog((prev) => [...prev, msg]);
  }

  const connect = useCallback(async () => {
    setStage("running");
    setLog([]);
    setError("");
    setReceived(0);
    setTotal(0);

    const disconnect = await openDroneConnection(BAUD_RATE, {
      onLog: addLog,
      onProgress(recv, tot) {
        setReceived(recv);
        if (tot > 0) setTotal(tot);
      },
      onDone(params) {
        disconnectRef.current = null;
        setStage("done");
        setReceived(params.length);
        onParamsLoaded(params.map((p) => ({ name: p.name, value: p.value })));
      },
      onError(msg) {
        disconnectRef.current = null;
        setError(msg);
        setStage("error");
        addLog(`✗ ${msg}`);
      },
    });

    disconnectRef.current = disconnect;
  }, [onParamsLoaded]);

  function handleClose() {
    disconnectRef.current?.();
    onClose();
  }

  const pct = total > 0 ? Math.round((received / total) * 100) : 0;
  const busy = stage === "running";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={!busy ? handleClose : undefined}
      />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Usb className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Connect to drone</h2>
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
          {stage === "idle" && (
            <p className="text-xs text-muted-foreground">
              Connect your flight controller via USB. Chrome will show a COM port picker.
            </p>
          )}

          {/* Progress bar */}
          {stage === "running" && total > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-150"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground text-right">
                {received} / {total} params ({pct}%)
              </p>
            </div>
          )}

          {/* Done summary */}
          {stage === "done" && (
            <p className="text-xs text-emerald-400">✓ {received} parameters loaded.</p>
          )}

          {/* Log */}
          {log.length > 0 && (
            <div className="rounded-md border border-border bg-black/30 px-3 py-2 max-h-44 overflow-y-auto flex flex-col gap-0.5">
              {log.map((line, i) => (
                <p key={i} className={`font-mono text-[11px] leading-relaxed ${line.startsWith("✗") || line.startsWith("⚠") ? "text-amber-400" : "text-muted-foreground"}`}>
                  <span className="text-muted-foreground/40 mr-1.5">›</span>{line}
                </p>
              ))}
              {busy && (
                <p className="font-mono text-[11px] text-muted-foreground/40 animate-pulse">
                  <span className="mr-1.5">›</span>…
                </p>
              )}
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
          {(stage === "idle" || stage === "error") && (
            <button
              onClick={connect}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Usb className="h-3.5 w-3.5" />
              {stage === "error" ? "Retry" : "Connect"}
            </button>
          )}
          {busy && (
            <button
              onClick={handleClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
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
