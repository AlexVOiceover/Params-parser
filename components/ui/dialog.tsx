"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

const SIZE = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-2xl", xl: "max-w-4xl" } as const;

interface DialogProps {
  title: string;
  onClose: () => void;
  /** While true the dialog cannot be dismissed (a request is in flight). */
  busy?: boolean;
  size?: keyof typeof SIZE;
  /** When given, the dialog is a form: Enter submits it. */
  onSubmit?: (e: React.FormEvent) => void;
  /** Buttons, right-aligned. Put the main action last. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}

/** The app's modal: closes on Escape or a click outside, and is announced as a dialog. */
export function Dialog({ title, onClose, busy = false, size = "md", onSubmit, footer, children }: DialogProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  // Move keyboard focus into the dialog so Tab starts at its first control.
  useEffect(() => { panel.current?.focus(); }, []);

  const inner = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <h2 id={titleId} className="text-base font-semibold text-foreground">{title}</h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          disabled={busy}
          className="-mr-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">{children}</div>
      {footer && <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-secondary/40 px-5 py-3">{footer}</div>}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={() => !busy && onClose()} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-10 flex max-h-[90vh] w-full ${SIZE[size]} flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl outline-none`}
      >
        {onSubmit ? <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">{inner}</form> : inner}
      </div>
    </div>
  );
}
