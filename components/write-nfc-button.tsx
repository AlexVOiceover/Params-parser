"use client";

import { Nfc, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useNFC } from "@/lib/use-nfc";

interface Props {
  serial: string;
  /** If true, show only the icon with a tooltip (for compact rows). */
  iconOnly?: boolean;
  label?: string;
  className?: string;
}

/**
 * Writes a drone serial to an NFC tag via the Web NFC API.
 * Renders nothing on platforms where the API isn't available (iOS, desktop).
 */
export function WriteNFCButton({ serial, iconOnly = false, label = "Write NFC tag", className }: Props) {
  const { isSupported, status, errorType, write, reset } = useNFC();

  if (!isSupported) return null;

  const baseClass = "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap";

  if (status === "waiting") {
    return (
      <span className={`${baseClass} animate-pulse border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 ${className ?? ""}`}>
        <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
        {!iconOnly && "Tap phone to tag…"}
      </span>
    );
  }

  if (status === "success") {
    return (
      <span className={`${baseClass} border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ${className ?? ""}`}>
        <CheckCircle className="h-3.5 w-3.5 shrink-0" />
        {!iconOnly && "Tag written"}
      </span>
    );
  }

  if (status === "error") {
    const msg = errorType === "permission_denied"
      ? "Permission denied"
      : errorType === "not_supported"
      ? "NFC not available"
      : "Write failed";
    return (
      <span className={`${baseClass} border border-destructive/40 bg-destructive/10 text-destructive ${className ?? ""}`}>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        {!iconOnly && <><span>{msg}</span> <button type="button" onClick={reset} className="underline cursor-pointer">Retry</button></>}
        {iconOnly && <button type="button" onClick={reset} className="underline cursor-pointer ml-0.5">↺</button>}
      </span>
    );
  }

  // Idle
  return (
    <button
      type="button"
      onClick={() => write(serial)}
      title={iconOnly ? `Write NFC tag for ${serial}` : undefined}
      aria-label={`Write NFC tag for ${serial}`}
      className={`${baseClass} border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground ${className ?? ""}`}
    >
      <Nfc className="h-3.5 w-3.5 shrink-0" />
      {!iconOnly && label}
    </button>
  );
}
