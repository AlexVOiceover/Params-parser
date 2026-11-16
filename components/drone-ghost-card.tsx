"use client";

import { useState } from "react";
import Link from "next/link";
import { Usb, ChevronDown, ChevronUp, Bell, Link2, Info } from "lucide-react";
import { BusyButton, Spinner } from "@/components/ui/busy";
import { ApplyUpdateButton } from "@/components/apply-update-button";
import { DiffList, SaveFromDroneForm } from "@/components/drone-status-panel";
import { useAuth } from "@/components/auth-provider";
import { useDroneParams } from "@/lib/drone-params-context";
import { useConnectedDroneMatch, refreshDroneMatch } from "@/lib/use-connected-drone-match";

interface Props {
  droneId: string;
  /** Chip ID linked to this page's drone record, if any. */
  droneChipId: string | null;
  droneSerial: string | null;
  nextLabel: string;
  onChanged: () => void;
}

/**
 * The connected drone, shown at the top of its own history: a ghost "next
 * version" card when it differs from the stored version (save it or restore),
 * an apply banner when an update is waiting, and nothing when it's in sync.
 * Every action requires the plugged-in chip to be linked to this record.
 */
export function DroneGhostCard({ droneId, droneChipId, droneSerial, nextLabel, onChanged }: Props) {
  const { droneParams } = useDroneParams();
  const match = useConnectedDroneMatch();
  const { role } = useAuth();
  const [showDiff, setShowDiff] = useState(false);

  if (!droneParams || droneParams.length === 0) return null;

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
    const href = drone.family_slug && drone.client_set_id ? `/${drone.family_slug}/${drone.variant_id}/${drone.client_set_id}` : null;
    return (
      <Note>
        <Usb className="h-3.5 w-3.5 shrink-0" />
        <span>
          The connected drone is <span className="font-mono text-foreground">{drone.serial}</span>, not this one.
          {href && <> <Link href={href} className="text-primary hover:underline cursor-pointer whitespace-nowrap">Open its history</Link></>}
        </span>
      </Note>
    );
  }

  if (state === "update_available" && desired) {
    return (
      <div className="flex items-center gap-3 flex-wrap rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3">
        <Bell className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-xs text-foreground">
          The connected drone is on v{match.lastVerified?.label}. v{desired.label} changes {diff.length} param{diff.length === 1 ? "" : "s"}.
        </span>
        <DiffToggle open={showDiff} count={diff.length} onToggle={() => setShowDiff((v) => !v)} />
        <div className="ml-auto"><ApplyUpdateButton version={desired} label={`Apply v${desired.label}`} /></div>
        {showDiff && <div className="w-full"><DiffList diff={diff} versionLabel={desired.label} /></div>}
      </div>
    );
  }

  const differs = (state === "modified" || state === "differs") && desired;
  if (!differs && state !== "no_version") return null;

  return (
    <div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-3 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-foreground font-mono">v{nextLabel}</span>
        <span className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary whitespace-nowrap">
          <Usb className="h-2.5 w-2.5" /> from the connected drone · not saved
        </span>
        {match.droneFirmware && <span className="font-mono text-[10px] text-muted-foreground">fw {match.droneFirmware}</span>}
      </div>

      {differs ? (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-foreground">
              {diff.length} param{diff.length === 1 ? "" : "s"} on the drone differ from v{desired.label}.
            </span>
            <DiffToggle open={showDiff} count={diff.length} onToggle={() => setShowDiff((v) => !v)} />
          </div>
          {showDiff && <DiffList diff={diff} versionLabel={desired.label} />}
          <p className="text-[11px] text-muted-foreground leading-snug">
            <span className="text-foreground font-medium">Save as v{nextLabel}</span> keeps what&apos;s on the drone as the next version.{" "}
            <span className="text-foreground font-medium">Restore v{desired.label}</span> writes v{desired.label} back to the drone.
          </p>
          <SaveFromDroneForm
            saveLabel={`Save as v${nextLabel}`}
            onSaved={onChanged}
            extraAction={<ApplyUpdateButton version={desired} label={`Restore v${desired.label}`} />}
          />
        </>
      ) : (
        <>
          <p className="text-xs text-foreground">This history has no approved version yet. Save the drone&apos;s current params to start it.</p>
          <SaveFromDroneForm saveLabel={`Save as v${nextLabel}`} onSaved={onChanged} />
        </>
      )}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-xs text-muted-foreground">
      {children}
    </div>
  );
}

function DiffToggle({ open, count, onToggle }: { open: boolean; count: number; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer whitespace-nowrap"
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
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4 py-3">
      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Link2 className="h-3.5 w-3.5 shrink-0 mt-px text-primary" />
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
            busy={linking}
            busyLabel="Linking…"
            icon={<Link2 className="h-3.5 w-3.5" />}
            onClick={link}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary"
          >
            {droneChipId ? `Re-link to ${serial}` : `Link to ${serial}`}
          </BusyButton>
        </div>
      )}
      {error && <p className="text-[11px] text-rose-700 dark:text-rose-300">{error}</p>}
    </div>
  );
}
