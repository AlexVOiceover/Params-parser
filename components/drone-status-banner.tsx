"use client";

import Link from "next/link";
import { Usb } from "lucide-react";
import { useDroneParams } from "@/lib/drone-params-context";
import { useConnectedDroneMatch } from "@/lib/use-connected-drone-match";
import { ApplyUpdateButton } from "@/components/apply-update-button";

/**
 * Compact status strip shown above the catalog when a drone is connected.
 * Purely informational — no action buttons. If there's an update, a single
 * link to the variant page is shown.
 */
export function DroneStatusBanner() {
  const { droneParams } = useDroneParams();
  const match = useConnectedDroneMatch();

  if (!droneParams || droneParams.length === 0) return null;

  const identified = match.status === "matched" && match.drone !== null;
  const { drone, versionStatus, droneVersion, catalogVersion } = match;

  return (
    <div className={`rounded-lg border px-4 py-3 mb-6 flex items-center gap-3 flex-wrap ${
      identified
        ? "border-emerald-500/40 bg-emerald-500/8"
        : "border-border bg-secondary/40"
    }`}>
      <Usb className={`h-4 w-4 shrink-0 ${identified ? "text-emerald-500" : "text-muted-foreground"}`} />

      {identified && drone ? (
        <>
          <span className="text-sm font-medium text-foreground">{drone.serial}</span>
          {drone.client_name && (
            <span className="text-sm text-muted-foreground">· {drone.client_name}</span>
          )}
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
          {versionStatus === "update_available" && droneVersion !== null && catalogVersion !== null && drone.latest_version_id && (
            <>
              <span className="text-xs text-amber-600 dark:text-amber-400">v{droneVersion} → v{catalogVersion}</span>
              <ApplyUpdateButton
                versionId={drone.latest_version_id}
                label="Apply update"
                className="flex items-center gap-1.5 rounded-md bg-amber-500 hover:bg-amber-600 px-2.5 py-1 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
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
          <span className="text-sm text-muted-foreground">Drone connected</span>
          <span className="text-xs text-muted-foreground">· {droneParams.length} params · not registered in catalog</span>
        </>
      )}
    </div>
  );
}
