"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, ClipboardList } from "lucide-react";
import { useDroneParams } from "@/lib/drone-params-context";
import { useConnectedDroneMatch } from "@/lib/use-connected-drone-match";
import { ApplyUpdateButton } from "@/components/apply-update-button";
import { RegisterDroneModal } from "@/components/register-drone-modal";

/**
 * Compact status strip shown above the catalog when a drone is connected.
 * Purely informational — no action buttons. If there's an update, a single
 * link to the variant page is shown.
 */
export function DroneStatusBanner() {
  const { droneParams } = useDroneParams();
  const match = useConnectedDroneMatch();
  const [showRegister, setShowRegister] = useState(false);

  if (!droneParams || droneParams.length === 0) return null;

  const identified = match.status === "matched" && match.drone !== null;
  const { drone, versionStatus, droneVersion, catalogVersion } = match;
  // Show register prompt when drone is unversioned (SCR_USER2=0)
  const needsRegistration = match.droneVersion === null &&
    (match.status === "unmatched" || (match.status === "matched" && match.drone !== null));

  return (
    <>
    <div className={`rounded-lg border px-4 py-3 mb-6 flex items-center gap-3 flex-wrap ${
      identified
        ? "border-emerald-500/40 bg-emerald-500/8"
        : "border-border bg-secondary/40"
    }`}>
      {/* Always show View link when drone is connected */}
      <Link
        href="/compare?v=__drone__"
        title="View drone params"
        className={`rounded-md border p-1 transition-colors cursor-pointer shrink-0 ${
          identified
            ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15"
            : "border-border text-muted-foreground hover:bg-secondary"
        }`}
      >
        <Eye className="h-3.5 w-3.5" />
      </Link>

      {identified && drone ? (
        <>
          <span className="text-sm font-medium text-foreground">{drone.serial}</span>
          {match.isOrphan ? (
            <span className="text-xs text-muted-foreground italic">no client</span>
          ) : drone.client_name ? (
            <span className="text-sm text-muted-foreground">· {drone.client_name}</span>
          ) : null}
          {drone.family_name && drone.variant_name && drone.family_slug && (
            <Link
              href={`/${drone.family_slug}/${drone.variant_id}`}
              className="text-sm text-primary hover:underline"
            >
              {drone.family_name} / {drone.variant_name}
            </Link>
          )}
          {versionStatus === "up_to_date" && droneVersion !== null && (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">v{droneVersion} — up to date</span>
          )}
          {versionStatus === "up_to_date_modified" && droneVersion !== null && match.driftCount !== null && drone.latest_version_id && (
            <>
              <span className="text-xs text-amber-600 dark:text-amber-400">
                v{droneVersion} — {match.driftCount} param{match.driftCount === 1 ? "" : "s"} modified
              </span>
              <Link
                href={`/compare?v=__drone__&v=${drone.latest_version_id}`}
                className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline whitespace-nowrap"
              >
                Review
              </Link>
            </>
          )}
          {versionStatus === "update_available" && droneVersion !== null && catalogVersion !== null && drone.latest_version_id && (
            <>
              <span className="text-xs text-amber-600 dark:text-amber-400">v{droneVersion} → v{catalogVersion}</span>
              <ApplyUpdateButton
                versionId={drone.latest_version_id}
                label="Apply update"
                className="btn-apply-update flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-white cursor-pointer whitespace-nowrap"
              />
            </>
          )}
          {versionStatus === "drone_ahead" && droneVersion !== null && catalogVersion !== null && (
            <span className="text-xs text-sky-600 dark:text-sky-400">
              Drone v{droneVersion} is ahead of catalog v{catalogVersion}
            </span>
          )}
        </>
      ) : (
        <>
          <span className="text-sm text-muted-foreground">
            {match.status === "loading" ? "Identifying drone…" : "Drone connected"}
          </span>
          <span className="text-xs text-muted-foreground">
            · {droneParams.length} params
            {match.status !== "loading" && " · not registered in catalog"}
          </span>
        </>
      )}
      {needsRegistration && (
        <button
          type="button"
          onClick={() => setShowRegister(true)}
          className="flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 hover:bg-primary/20 px-2.5 py-1 text-xs font-medium text-primary transition-colors cursor-pointer whitespace-nowrap shrink-0 ml-auto"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Register drone
        </button>
      )}
    </div>
    {showRegister && <RegisterDroneModal onClose={() => setShowRegister(false)} />}
    </>
  );
}
