"use client";

import { useState } from "react";
import { Tag, CheckCircle, AlertTriangle, X, Wifi } from "lucide-react";
import { useNFC } from "@/lib/use-nfc";

interface Props {
  serial: string;
  /** If true, show only the icon (no text label) for compact rows. */
  iconOnly?: boolean;
  label?: string;
  className?: string;
}

/**
 * Writes a drone serial to an NFC tag via the Web NFC API.
 * Renders nothing on platforms where the API isn't available (iOS, desktop).
 * Shows a modal overlay with animated feedback during the write.
 */
export function WriteNFCButton({ serial, iconOnly = false, label = "Write NFC tag", className }: Props) {
  const { isSupported, status, errorType, write, reset } = useNFC();
  const [modalOpen, setModalOpen] = useState(false);

  if (!isSupported) return null;

  function handleOpen() {
    reset();
    setModalOpen(true);
    // Start the write immediately when the modal opens — the waiting animation
    // shows while the phone looks for a tag. A minimum display of 1.2s ensures
    // the animation is visible even when the tag responds instantly.
    const minWait = new Promise<void>((r) => setTimeout(r, 1200));
    void Promise.all([write(serial), minWait]);
  }

  function handleClose() {
    reset();
    setModalOpen(false);
  }

  function handleRetry() {
    reset();
    const minWait = new Promise<void>((r) => setTimeout(r, 1200));
    void Promise.all([write(serial), minWait]);
  }

  const errorMsg = errorType === "permission_denied"
    ? "NFC permission denied. Please allow NFC access and try again."
    : errorType === "not_supported"
    ? "NFC is not available on this device or browser."
    : "Write failed. Make sure the tag is close and try again.";

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        title={`Write NFC tag for ${serial}`}
        aria-label={`Write NFC tag for ${serial}`}
        className={`flex items-center gap-1.5 rounded-md border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors cursor-pointer ${
          iconOnly ? "p-1.5" : "px-2.5 py-1.5 text-xs font-medium"
        } ${className ?? ""}`}
      >
        <Tag className="h-3.5 w-3.5 shrink-0" />
        {!iconOnly && label}
      </button>

      {/* Modal overlay */}
      {modalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={status === "waiting" ? undefined : handleClose} />
          <div className="relative z-10 w-full max-w-xs rounded-xl border border-border bg-card shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Write NFC tag</h2>
              </div>
              {status !== "waiting" && (
                <button onClick={handleClose} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="px-5 py-6 flex flex-col items-center gap-4 text-center">

              {/* Idle — briefly shown before write starts (should not be visible normally) */}
              {status === "idle" && (
                <div className="py-4">
                  <Wifi className="h-8 w-8 text-primary animate-pulse mx-auto" />
                </div>
              )}

              {/* Waiting — hold phone to tag */}
              {status === "waiting" && (
                <>
                  {/* Animated rings */}
                  <div className="relative flex items-center justify-center w-20 h-20">
                    <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" style={{ animationDuration: "1.5s" }} />
                    <div className="absolute inset-2 rounded-full border-2 border-primary/30 animate-ping" style={{ animationDuration: "1.5s", animationDelay: "0.3s" }} />
                    <div className="absolute inset-4 rounded-full border-2 border-primary/40 animate-ping" style={{ animationDuration: "1.5s", animationDelay: "0.6s" }} />
                    <Wifi className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Tap phone to tag</p>
                  <p className="text-xs text-muted-foreground">Hold the phone close to the NFC sticker</p>
                  <div className="rounded-md border border-border bg-secondary/40 px-3 py-2 w-full text-left">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Writing serial:</p>
                    <p className="text-xs font-mono text-foreground">{serial}</p>
                  </div>
                </>
              )}

              {/* Success */}
              {status === "success" && (
                <>
                  <CheckCircle className="h-12 w-12 text-emerald-400" />
                  <p className="text-sm font-medium text-foreground">Tag written</p>
                  <p className="text-xs text-muted-foreground">The NFC sticker now links to drone <span className="font-mono">{serial}</span>.</p>
                  <button onClick={handleClose} className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
                    Done
                  </button>
                </>
              )}

              {/* Error */}
              {status === "error" && (
                <>
                  <AlertTriangle className="h-10 w-10 text-amber-400" />
                  <p className="text-sm font-medium text-foreground">Write failed</p>
                  <p className="text-xs text-muted-foreground">{errorMsg}</p>
                  <div className="flex gap-2 w-full">
                    <button onClick={handleClose} className="flex-1 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer">
                      Cancel
                    </button>
                    <button onClick={handleRetry} className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">
                      Retry
                    </button>
                  </div>
                </>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}
