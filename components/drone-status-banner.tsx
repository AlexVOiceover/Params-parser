"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, ChevronDown, ChevronUp } from "lucide-react";
import { useDroneParams } from "@/lib/drone-params-context";
import { useConnectedDroneMatch } from "@/lib/use-connected-drone-match";
import { useAuth } from "@/components/auth-provider";
import { ApplyUpdateButton } from "@/components/apply-update-button";
import { RegisterDroneModal } from "@/components/register-drone-modal";
import { DroneStatusPanel } from "@/components/drone-status-panel";

/**
 * Compact status strip shown above the catalog when a drone is connected.
 * "Details" expands the full status panel (change list, link picker, actions).
 */
export function DroneStatusBanner() {
  const { droneParams } = useDroneParams();
  const match = useConnectedDroneMatch();
  const { role } = useAuth();
  const isStaff = role === "admin" || role === "contributor";
  const [expanded, setExpanded] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  if (!droneParams || droneParams.length === 0) return null;

  const { drone, desired, pending, diff, state } = match;
  const linked = match.status === "linked" && drone !== null;
  const n = diff.length;

  let summary: React.ReactNode;
  if (match.status === "loading") summary = <span className="text-sm text-muted-foreground">Identifying drone…</span>;
  else if (match.status === "no_chip") summary = <span className="text-sm text-muted-foreground">Drone connected · no chip ID reported</span>;
  else if (match.status === "error") summary = <span className="text-sm text-muted-foreground">Drone connected · couldn&apos;t check against the catalog</span>;
  else if (match.status === "unlinked") summary = <span className="text-sm text-muted-foreground">Drone connected · not linked to a drone record</span>;
  else if (linked) {
    summary = (
      <>
        <span className="text-sm font-medium text-foreground">{drone.serial}</span>
        {drone.client_name
          ? <span className="text-sm text-muted-foreground">· {drone.client_name}</span>
          : <span className="text-xs text-muted-foreground italic">no client</span>}
        {drone.family_name && drone.variant_name && drone.family_slug && (
          <Link href={`/${drone.family_slug}/${drone.variant_id}`} className="text-sm text-primary hover:underline">
            {drone.family_name} / {drone.variant_name}
          </Link>
        )}
        {state === "in_sync" && desired && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">in sync with v{desired.label}</span>
        )}
        {state === "update_available" && desired && (
          <>
            <span className="text-xs text-amber-600 dark:text-amber-400">update v{desired.label} · {n} param{n === 1 ? "" : "s"}</span>
            <ApplyUpdateButton
              version={desired}
              label="Install update"
              className="btn-apply-update rounded-md px-2.5 py-1 text-xs font-medium text-white"
            />
          </>
        )}
        {(state === "modified" || state === "differs") && desired && (
          <>
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {n} param{n === 1 ? "" : "s"} differ from v{desired.label}
            </span>
            <Link
              href={`/compare?v=__drone__&v=${desired.id}`}
              className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline whitespace-nowrap"
            >
              Review
            </Link>
          </>
        )}
        {state === "pending_review" && pending && (
          <span className="text-xs text-amber-600 dark:text-amber-400">saved as v{pending.label} · waiting for review</span>
        )}
        {state === "no_version" && <span className="text-xs text-muted-foreground">no approved version yet</span>}
      </>
    );
  }

  return (
    <>
      <div className={`rounded-lg border mb-6 ${linked ? "border-emerald-500/40 bg-emerald-500/8" : "border-border bg-secondary/40"}`}>
        <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
          <Link
            href="/compare?v=__drone__"
            title="View drone params"
            aria-label="View drone params"
            className={`rounded-md border p-1 transition-colors cursor-pointer shrink-0 ${
              linked
                ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
          </Link>
          {summary}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer whitespace-nowrap"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Details
          </button>
        </div>
        {expanded && (
          <div className="px-4 pb-3">
            <DroneStatusPanel match={match} onRegister={isStaff ? () => setShowRegister(true) : undefined} />
          </div>
        )}
      </div>
      {showRegister && <RegisterDroneModal mode="capture" onClose={() => setShowRegister(false)} />}
    </>
  );
}
