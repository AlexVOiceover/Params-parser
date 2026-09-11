"use client";

import { Loader2 } from "lucide-react";

/**
 * Shared busy-state primitives.
 *
 * The rule for this app: any action that can take even a moment must
 * acknowledge the press immediately. Use these rather than hand-rolling a
 * spinner per component, so the feedback looks and behaves the same everywhere.
 */

/** Inline spinner sized to sit next to button text. */
export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`h-3.5 w-3.5 animate-spin ${className}`} aria-hidden="true" />;
}

interface BusyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  busy?: boolean;
  /** Label shown while busy. Falls back to the normal children. */
  busyLabel?: string;
  icon?: React.ReactNode;
}

/**
 * Button that shows a spinner and disables itself while an action is in
 * flight, preventing the double-submits that plague the invite and upload
 * flows.
 */
export function BusyButton({
  busy = false,
  busyLabel,
  icon,
  children,
  disabled,
  className = "",
  ...rest
}: BusyButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap ${className}`}
    >
      {busy ? <Spinner /> : icon}
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

/**
 * Row placeholder used while a list or table loads. `lines` controls height so
 * the skeleton roughly matches the content it stands in for.
 */
export function SkeletonRows({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card px-4 py-3">
          <div className="h-3.5 w-1/3 rounded bg-secondary animate-pulse" />
          <div className="mt-2.5 h-2.5 w-2/3 rounded bg-secondary/70 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

/** Block placeholder for a heading + body area. */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-secondary animate-pulse ${className}`} aria-hidden="true" />;
}

/**
 * Full-area loading state with an accessible announcement. Use inside a
 * route's loading.tsx or while a panel fetches.
 */
export function LoadingPanel({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
      <Spinner />
      {label}
    </div>
  );
}
