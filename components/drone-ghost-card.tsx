"use client";

import { useState } from "react";
import Link from "next/link";
import { Usb, ChevronDown, ChevronUp, Bell, Link2, Info, CheckCircle2 } from "lucide-react";
import { BusyButton, Spinner } from "@/components/ui/busy";
import { buttonClass, cardClass } from "@/components/ui/styles";
import { ApplyUpdateButton } from "@/components/apply-update-button";
import { DiffList, SaveFromDroneForm } from "@/components/drone-status-panel";
import { useAuth } from "@/components/auth-provider";
import { useDroneParams } from "@/lib/drone-params-context";
import { useConnectedDroneMatch, refreshDroneMatch } from "@/lib/use-connected-drone-match";
import { useSerialMode } from "@/lib/use-serial-mode";
import { droneHref } from "@/lib/versions";

interface Props {
  droneId: string;
  /** Chip ID linked to this page's drone record, if any. */
  droneChipId: string | null;
  droneSerial: string | null;
  nextLabel: string;
  onChanged: () => void;
}

/**
 * The connected drone, shown at the top of its own page: a prompt to connect,
 * a confirmation when it matches its target, an install banner when an update
 * is waiting, and a draft "next version" when it was changed on the drone.
 * Every action requires the plugged-in chip to be linked to this record.
 */
export function DroneGhostCard({ droneId, droneChipId, droneSerial, nextLabel, onChanged }: Props) {
  const { droneParams, openImportDialog } = useDroneParams();
  const match = useConnectedDroneMatch();
  const { role } = useAuth();
  const serialMode = useSerialMode();
  const [showDiff, setShowDiff] = useState(false);

  if (!droneParams || droneParams.length === 0) {
    if (serialMode === "unsupported") return null;
    return (
      <div className={`${cardClass} flex flex-wrap items-center gap-3 px-4 py-3.5`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Usb className="h-4 w-4" />
        </span>
        <div className="min-w-48 flex-1">
          <p className="text-sm font-medium text-foreground">Is it on the right params?</p>
          <p className="text-[13px] text-muted-foreground">
            Plug {droneSerial ?? "the drone"} in to check it against its target, install updates, or save changes made in Mission Planner.
          </p>
        </div>
        <button type="button" onClick={openImportDialog} className={buttonClass("primary")}>
          <Usb className="h-3.5 w-3.5" /> Connect drone
        </button>
      </div>
    );
  }

  if (match.status === "loading" || match.status === "idle") {
    return (
      <Note>
        <Spinner className="h-3.5 w-3.5" /> Checking the connected drone…
      </Note>
    );
  }
  if (match.status === "no_chip" || match.status === "error") {
    return (
      <Note>
        <Info className="h-3.5 w-3.5 shrink-0" />
        {match.status === "no_chip"
          ? "The connected drone didn't report a chip ID, so it can't be matched to this drone. Reconnect to try again."
          : "Couldn't check the connected drone against this history."}
      </Note>
    );
  }
  if (match.status === "unlinked") {
    return <LinkHere droneId={droneId} droneChipId={droneChipId} droneSerial={droneSerial} isAdmin={role === "admin"} isStaff={role === "admin" || role === "contributor"} />;
  }

  const { drone, state, desired, diff } = match;
  if (!drone) return null;

  if (drone.id !== droneId) {
    const href = droneHref(drone.serial);
    return (
      <Note>
        <Usb className="h-3.5 w-3.5 shrink-0" />
        <span>
          The connected drone is <span className="font-mono text-foreground">{drone.serial}</span>, not this one.
          {" "}<Link href={href} className="text-primary hover:underline cursor-pointer whitespace-nowrap">Open {drone.serial}</Link>
        </span>
      </Note>
    );
  }

  if (state === "update_available" && desired) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
          <Bell className="h-4 w-4" />
        </span>
        <div className="min-w-48 flex-1">
          <p className="text-sm font-medium text-foreground">An update is waiting</p>
          <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-foreground">
            The connected drone is on v{match.lastVerified?.label}. v{desired.label} changes {diff.length} param{diff.length === 1 ? "" : "s"}.
            <DiffToggle open={showDiff} count={diff.length} onToggle={() => setShowDiff((v) => !v)} />
          </p>
        </div>
        <ApplyUpdateButton version={desired} label={`Install v${desired.label}`} />
        {showDiff && <div className="w-full"><DiffList diff={diff} versionLabel={desired.label} /></div>}
      </div>
    );
  }

  if (state === "in_sync" || state === "pending_review") {
    const label = state === "in_sync" ? desired?.label : match.pending?.label;
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-600/35 bg-emerald-500/10 px-4 py-3 text-sm text-foreground">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <span className="font-medium">
          {state === "in_sync"
            ? <>Connected and matching v{label}, its target.</>
            : <>Connected and matching v{label}, which is waiting for review.</>}
        </span>
      </div>
    );
  }

  const differs = (state === "modified" || state === "differs") && desired;
  if (!differs && state !== "no_version") return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-dashed border-primary/45 bg-primary/5 px-4 py-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-mono text-lg font-semibold leading-6 text-foreground">v{nextLabel}</span>
        <span className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary whitespace-nowrap">
          <Usb className="h-3 w-3" /> from the connected drone · not saved
        </span>
        {match.droneFirmware && <span className="text-xs text-muted-foreground">ArduPilot {match.droneFirmware}</span>}
      </div>

      {differs ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-foreground">
              {diff.length} param{diff.length === 1 ? "" : "s"} on the drone differ from v{desired.label}.
            </span>
            <DiffToggle open={showDiff} count={diff.length} onToggle={() => setShowDiff((v) => !v)} />
          </div>
          {showDiff && <DiffList diff={diff} versionLabel={desired.label} />}
          <p className="text-[13px] leading-snug text-muted-foreground">
            To keep these changes, save them as v{nextLabel}. To undo them, install v{desired.label} from its card below.
          </p>
          <SaveFromDroneForm saveLabel={`Save as v${nextLabel}`} onSaved={onChanged} />
        </>
      ) : (
        <>
          <p className="text-sm text-foreground">This history has no approved version yet. Save the drone&apos;s current params to start it.</p>
          <SaveFromDroneForm saveLabel={`Save as v${nextLabel}`} onSaved={onChanged} />
        </>
      )}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${cardClass} flex items-center gap-2.5 px-4 py-3 text-[13px] text-muted-foreground`}>
      {children}
    </div>
  );
}

function DiffToggle({ open, count, onToggle }: { open: boolean; count: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1 text-[13px] font-medium text-primary hover:underline cursor-pointer whitespace-nowrap"
    >
      {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      {open ? "Hide" : `Show the ${count}`}
    </button>
  );
}

/** The plugged-in chip isn't linked to any record: staff can link it to this one. */
function LinkHere({ droneId, droneChipId, droneSerial, isAdmin, isStaff }: {
  droneId: string;
  droneChipId: string | null;
  droneSerial: string | null;
  isAdmin: boolean;
  isStaff: boolean;
}) {
  const { autopilot } = useDroneParams();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serial = droneSerial ?? "this drone";
  // A record that already has a chip means a flight-controller swap: admin only.
  const canLink = droneChipId ? isAdmin : isStaff;

  async function link() {
    setLinking(true);
    setError(null);
    const res = await fetch(`/api/admin/drones/${droneId}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chipId: autopilot?.chipId, method: "connect", firmware: autopilot?.firmware ?? null }),
    });
    setLinking(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setError(body.error ?? "Could not link");
      return;
    }
    refreshDroneMatch();
  }

  return (
    <div className={`${cardClass} flex flex-col gap-3 px-4 py-3.5`}>
      <p className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          The connected flight controller (chip <span className="font-mono text-foreground">{autopilot?.chipId?.slice(0, 8)}…</span>) isn&apos;t linked to any drone.
          {droneChipId
            ? <> {serial} is linked to a different one (<span className="font-mono">{droneChipId.slice(0, 8)}…</span>). Re-link only if its flight controller was replaced.</>
            : <> Check the serial on the airframe label before linking it to {serial}.</>}
          {!isStaff && " Contact AIR6 to set it up."}
        </span>
      </p>
      {canLink && (
        <div>
          <BusyButton
            type="button"
            variant="primary"
            busy={linking}
            busyLabel="Linking…"
            icon={<Link2 className="h-3.5 w-3.5" />}
            onClick={link}
          >
            {droneChipId ? `Re-link to ${serial}` : `Link to ${serial}`}
          </BusyButton>
        </div>
      )}
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </div>
  );
}
