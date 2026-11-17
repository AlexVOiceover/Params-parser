"use client";

import { useState, useCallback, useRef, useEffect, useId } from "react";
import { Usb, X, AlertTriangle, AlertCircle, CheckCircle2, ChevronRight, type LucideIcon } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { buttonClass } from "@/components/ui/styles";
import { useDroneParams } from "@/lib/drone-params-context";
import { writeVerified, type WriteOutcome } from "@/lib/drone-flash-engine";

interface DroneDialogProps {
  title: string;
  /** Where a multi-step dialog is, shown after the title. */
  step?: string;
  onClose: () => void;
  /** While true the dialog cannot be dismissed (a read or a write is running). */
  locked?: boolean;
  /** Leave the close button out. */
  noCloseButton?: boolean;
  /** Tailwind max-width class of the panel. */
  width: string;
  /** Tailwind z-index class: a dialog opened from another one sits on a higher layer. */
  layer: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * The shared Dialog's look for the connected-drone dialogs (connect, register, write, NFC).
 * They open on top of each other and run reads and writes, so unlike Dialog they do not
 * close on Escape, and each one names its own layer.
 */
export function DroneDialog({ title, step, onClose, locked = false, noCloseButton = false, width, layer, footer, children }: DroneDialogProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => { panel.current?.focus(); }, []);

  return (
    <div className={`fixed inset-0 ${layer} flex items-center justify-center p-4`}>
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={locked ? undefined : onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-10 flex max-h-[90vh] w-full ${width} flex-col overflow-hidden rounded-2xl border border-border bg-card text-left text-sm font-normal whitespace-normal text-foreground shadow-2xl outline-none`}
      >
        <div className="flex min-h-15 shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2">
            <h2 id={titleId} className="text-base font-semibold text-foreground">{title}</h2>
            {step && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground capitalize whitespace-nowrap">
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
                {step}
              </span>
            )}
          </div>
          {!noCloseButton && (
            <button type="button" aria-label="Close" onClick={onClose} disabled={locked} className={buttonClass("ghost", "icon", "-mr-1.5")}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-secondary/40 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

const NOTICE_TONE = {
  ok: { box: "border-emerald-600/35 bg-emerald-500/10", icon: "text-emerald-700 dark:text-emerald-300" },
  warn: { box: "border-amber-500/50 bg-amber-500/10", icon: "text-amber-700 dark:text-amber-300" },
  info: { box: "border-sky-600/30 bg-sky-500/10", icon: "text-sky-700 dark:text-sky-300" },
  danger: { box: "border-destructive/40 bg-destructive/10", icon: "text-destructive" },
} as const;

interface NoticeProps {
  tone: keyof typeof NOTICE_TONE;
  icon: LucideIcon;
  role?: "alert" | "status";
  /** Shown under the sentence at the band's full width: a table, a button. */
  detail?: React.ReactNode;
  children: React.ReactNode;
}

/** A tinted band with an icon, for what the user has to know before going on. */
export function Notice({ tone, icon: Icon, role, detail, children }: NoticeProps) {
  return (
    <div role={role} className={`flex flex-col gap-3 rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed text-foreground ${NOTICE_TONE[tone].box}`}>
      <div className="flex items-start gap-2.5">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${NOTICE_TONE[tone].icon}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      {detail}
    </div>
  );
}

function logLineTone(line: string): string {
  if (line.startsWith("✗") || line.startsWith("⚠")) return "text-amber-700 dark:text-amber-400";
  if (line.startsWith("✓")) return "text-emerald-700 dark:text-emerald-400";
  return "text-muted-foreground";
}

/** The step-by-step lines of a read or a write. Keeps the newest line in view. */
export function SerialLog({ lines, running = false, label }: { lines: string[]; running?: boolean; label: string }) {
  const box = useRef<HTMLDivElement>(null);

  // Scrolls the log itself, not the dialog around it.
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [lines]);

  if (lines.length === 0) return null;
  return (
    <div
      ref={box}
      role="log"
      aria-label={label}
      className="flex max-h-44 shrink-0 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-secondary/50 px-3 py-2 font-mono text-xs leading-relaxed"
    >
      {lines.map((line, i) => (
        <p key={i} className={`flex gap-1.5 ${logLineTone(line)}`}>
          <span className="text-muted-foreground/60 select-none" aria-hidden="true">›</span>
          <span className="min-w-0 break-words">{line}</span>
        </p>
      ))}
      {running && (
        <p className="flex animate-pulse gap-1.5 text-muted-foreground/70" aria-hidden="true">
          <span>›</span>…
        </p>
      )}
    </div>
  );
}

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
  const ackId = useId();

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
  const troubled = failed.length > 0 || !!error;

  return (
    <DroneDialog
      title="Write to drone"
      onClose={onClose}
      locked={busy}
      width="max-w-md"
      layer="z-50"
      footer={
        <>
          {!busy && stage !== "done" && (
            <button type="button" onClick={onClose} className={buttonClass("secondary")}>Cancel</button>
          )}
          {(stage === "confirm" || stage === "running" || stage === "error") && (
            <BusyButton
              type="button"
              variant="warn"
              busy={busy}
              busyLabel="Writing and verifying…"
              icon={<Usb className="h-3.5 w-3.5" />}
              onClick={start}
              disabled={!acknowledged}
            >
              {stage === "error" ? "Retry" : `Write ${changes.length} param${changes.length === 1 ? "" : "s"}`}
            </BusyButton>
          )}
          {stage === "done" && (
            <button type="button" onClick={onClose} className={buttonClass("primary")}>Done</button>
          )}
        </>
      }
    >
      {stage === "confirm" && (
        <>
          {notice && <Notice tone="warn" icon={AlertCircle}>{notice}</Notice>}
          {firmwareWarning && (
            <Notice
              tone="danger"
              icon={AlertTriangle}
              detail={
                <div className="flex items-center gap-2.5 border-t border-destructive/25 pt-3">
                  <input
                    id={ackId}
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    className="h-5 w-5"
                  />
                  <label htmlFor={ackId} className="text-sm font-medium text-foreground cursor-pointer">
                    I understand — write anyway
                  </label>
                </div>
              }
            >
              {firmwareWarning}
            </Notice>
          )}
          <Notice tone="warn" icon={AlertTriangle}>
            About to write <span className="font-semibold">{changes.length}</span> param{changes.length === 1 ? "" : "s"} to the drone.
            Each one is read back to confirm it took. Make sure the drone is safe (disarmed, no props).
          </Notice>
          <div className="max-h-48 shrink-0 overflow-y-auto rounded-lg border border-border">
            <table className="w-full table-fixed border-separate border-spacing-0 text-xs">
              <thead className="sticky top-0 bg-card">
                <tr>
                  <th scope="col" className="border-b border-border bg-secondary/50 px-3 py-1.5 text-left font-medium text-muted-foreground">Param</th>
                  <th scope="col" className="border-b border-border bg-secondary/50 px-3 py-1.5 text-right font-medium text-muted-foreground">New value</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {changes.map((c, i) => {
                  const edge = i < changes.length - 1 ? "border-b border-border" : "";
                  return (
                    <tr key={c.name}>
                      <td className={`truncate px-3 py-1.5 text-foreground ${edge}`} title={c.name}>{c.name}</td>
                      <td className={`truncate px-3 py-1.5 text-right text-amber-700 dark:text-amber-300 ${edge}`} title={String(c.value)}>{c.value}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {stage === "done" && (
        <Notice tone={troubled ? "warn" : "ok"} icon={troubled ? AlertTriangle : CheckCircle2} role="status">
          <p className="font-medium">
            {verified} verified{failed.length > 0 ? ` · ${failed.length} did not take` : ""}
          </p>
          {failed.length > 0 && (
            <ul className="mt-1 flex flex-col gap-0.5 font-mono text-xs">
              {failed.map((f) => <li key={f.name}>{f.name}: {f.error}</li>)}
            </ul>
          )}
          {error && <p className="mt-1">{error}</p>}
        </Notice>
      )}

      {stage === "error" && <Notice tone="danger" icon={AlertCircle} role="alert">{error}</Notice>}

      <SerialLog lines={log} label="Write log" />
    </DroneDialog>
  );
}
