"use client";

import Link from "next/link";
import { RefreshCw, Usb } from "lucide-react";
import { Spinner } from "@/components/ui/busy";
import { useDroneParams } from "@/lib/drone-params-context";
import { useConnectedDroneMatch } from "@/lib/use-connected-drone-match";
import { useSerialMode } from "@/lib/use-serial-mode";
import { droneHref } from "@/lib/versions";
import type { DroneState } from "@/lib/desired-state";

const STATE: Record<DroneState, { text: (target: string | undefined) => string; tone: string; dot: string }> = {
  in_sync: { text: () => "Up to date", tone: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  update_available: { text: (t) => `Update to v${t}`, tone: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  modified: { text: () => "Changed on drone", tone: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  differs: { text: (t) => `Differs from v${t}`, tone: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  pending_review: { text: () => "Matches a proposal", tone: "border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300", dot: "bg-sky-500" },
  no_version: { text: () => "No version yet", tone: "border-border text-foreground", dot: "bg-muted-foreground" },
};

const base = "flex items-center gap-1.5 rounded-md border px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap";

/**
 * The plugged-in drone, on every page: who it is and how it compares, one
 * click from its page. Before a read it is the Connect button.
 */
export function DroneChip() {
  const { droneParams, openImportDialog } = useDroneParams();
  const match = useConnectedDroneMatch();
  const serialMode = useSerialMode();
  if (serialMode === "unsupported") return null;

  if (!droneParams || droneParams.length === 0) {
    return (
      <button type="button" onClick={openImportDialog} className={`${base} border-border text-foreground hover:bg-secondary`}>
        <Usb className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Connect drone</span>
      </button>
    );
  }

  const readAgain = (
    <button
      type="button"
      onClick={openImportDialog}
      aria-label="Read the drone again"
      title="Read the drone again"
      className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
    >
      <RefreshCw className="h-3.5 w-3.5" />
    </button>
  );

  if (match.status === "linked" && match.drone && match.state) {
    const s = STATE[match.state];
    return (
      <div className="flex items-center gap-1">
        <Link href={droneHref(match.drone.serial)} title={`Open ${match.drone.serial}`} className={`${base} ${s.tone} hover:opacity-90`}>
          <span className={`h-2 w-2 rounded-full ${s.dot}`} aria-hidden="true" />
          <span className="font-mono">{match.drone.serial}</span>
          <span className="hidden md:inline">· {s.text(match.desired?.label)}</span>
        </Link>
        {readAgain}
      </div>
    );
  }

  const label = match.status === "loading" || match.status === "idle" ? "Checking drone…"
    : match.status === "unlinked" ? "New flight controller"
    : "Drone not identified";
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={openImportDialog} className={`${base} border-border text-foreground hover:bg-secondary`}>
        {match.status === "loading" || match.status === "idle" ? <Spinner /> : <Usb className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{label}</span>
      </button>
      {match.status !== "loading" && match.status !== "idle" && readAgain}
    </div>
  );
}
