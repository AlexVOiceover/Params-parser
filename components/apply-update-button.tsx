"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpCircle } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import type { ButtonVariant } from "@/components/ui/styles";
import { useDroneParams } from "@/lib/drone-params-context";
import { WriteDroneDialog, type WriteChange } from "@/components/write-drone-dialog";
import { refreshDroneMatch } from "@/lib/use-connected-drone-match";
import { applyVersion, changesFor, fetchVersionValues, type WriteOutcome } from "@/lib/drone-flash-engine";
import { firmwareMinor, firmwareMismatch, type VersionRef } from "@/lib/desired-state";

interface Props {
  /** The version of the drone's history to bring the drone to. */
  version: VersionRef;
  /** "warn" for the version the drone should be on; "quiet" for any other version. */
  variant?: ButtonVariant;
  label?: string;
  /** Shown in the confirm dialog, e.g. when installing a version that isn't the target. */
  notice?: string;
}

/**
 * Brings the connected drone to `version`: writes only the differing managed
 * params, reads them back, and logs the apply once the server confirms the
 * drone now equals the version.
 */
export function ApplyUpdateButton({ version, variant = "warn", label = "Install update", notice }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { droneParams, autopilot, setDroneParams } = useDroneParams();
  const [loading, setLoading] = useState(false);
  const [changes, setChanges] = useState<WriteChange[] | null>(null);
  const [desired, setDesired] = useState<Map<string, number>>(new Map());
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!droneParams || droneParams.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const values = await fetchVersionValues(version.id);
      if (values.size === 0) { setError("This version has no params."); return; }
      setDesired(values);
      setChanges(changesFor(values, droneParams));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the version");
    } finally {
      setLoading(false);
    }
  }

  const handleSuccess = useCallback((outcome: WriteOutcome) => {
    setDroneParams(outcome.params);
    refreshDroneMatch();
    startTransition(() => router.refresh());
  }, [setDroneParams, router]);

  const mismatch = firmwareMismatch(version.firmware, autopilot?.firmware ?? null);

  return (
    <>
      <BusyButton
        type="button"
        busy={loading}
        busyLabel="Loading…"
        icon={<ArrowUpCircle className="h-3.5 w-3.5" />}
        onClick={handleClick}
        disabled={!droneParams?.length}
        variant={variant}
      >
        {label}
      </BusyButton>
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
      {changes && (
        <WriteDroneDialog
          changes={changes}
          onClose={() => setChanges(null)}
          notice={notice}
          onSuccess={handleSuccess}
          firmwareWarning={mismatch
            ? `v${version.label} was made for ArduPilot ${firmwareMinor(version.firmware)}, this drone runs ${firmwareMinor(autopilot?.firmware ?? null)}. Params added or renamed between them will not match.`
            : undefined}
          onStart={(addLog) => applyVersion(version.id, version.label, desired, droneParams ?? [], autopilot, addLog)}
        />
      )}
    </>
  );
}
