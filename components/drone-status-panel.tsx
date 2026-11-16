"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, AlertCircle, Bell, Link2, Save, RefreshCw } from "lucide-react";
import { BusyButton, Spinner } from "@/components/ui/busy";
import { ApplyUpdateButton } from "@/components/apply-update-button";
import { ParamInfoHover } from "@/components/param-info-hover";
import { useAuth } from "@/components/auth-provider";
import { useDroneParams } from "@/lib/drone-params-context";
import { refreshDroneMatch, type DroneMatchResult } from "@/lib/use-connected-drone-match";
import { firmwareMinor, type ParamDiff } from "@/lib/desired-state";

interface Props {
  match: DroneMatchResult;
  /** Staff action for an unknown chip that isn't any existing record. */
  onRegister?: () => void;
}

/** Drones store 32-bit floats; 7 significant digits drops the float noise. */
function formatParamValue(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n) || Number.isInteger(n)) return String(value);
  return String(Number(n.toPrecision(7)));
}

function DiffList({ diff, versionLabel }: { diff: ParamDiff[]; versionLabel: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? diff : diff.slice(0, 8);
  return (
    <div className="rounded border border-border bg-background/50 max-h-56 overflow-auto">
      <table className="w-full font-mono text-[11px] whitespace-nowrap">
        <thead className="sticky top-0 z-10 bg-card font-sans text-[10px] uppercase tracking-wide">
          <tr className="border-b border-border">
            <th scope="col" className="px-2 py-1 text-left font-medium text-muted-foreground">Param</th>
            <th scope="col" className="px-2 py-1 text-right font-medium text-sky-700 dark:text-sky-300">Read from drone</th>
            <th scope="col" className="px-2 py-1 text-right font-medium text-amber-700 dark:text-amber-300">Stored v{versionLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {shown.map((d) => (
            <tr key={d.name}>
              <td className="px-2 py-1"><ParamInfoHover name={d.name} highlight={[String(d.actual), String(d.desired)]} /></td>
              <td className="px-2 py-1 text-right text-foreground">
                {d.actual === null ? <span className="italic font-sans text-muted-foreground">not on drone</span> : formatParamValue(d.actual)}
              </td>
              <td className="px-2 py-1 text-right text-amber-700 dark:text-amber-300">{formatParamValue(d.desired)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {diff.length > 8 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="w-full border-t border-border px-2 py-1 text-[11px] text-primary hover:underline cursor-pointer whitespace-nowrap"
        >
          {all ? "Show fewer" : `Show all ${diff.length}`}
        </button>
      )}
    </div>
  );
}

function SaveAsNewVersionButton() {
  const { droneParams, autopilot } = useDroneParams();
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setSaving(true);
    setResult(null);
    const res = await fetch("/api/drone/versions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chipId: autopilot?.chipId, firmware: autopilot?.firmware ?? null, params: droneParams }),
    });
    const body = await res.json().catch(() => ({})) as { label?: string; approved?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) {
      setResult({ ok: false, text: body.error ?? "Could not save the version" });
      return;
    }
    setResult({ ok: true, text: body.approved ? `Saved as v${body.label}` : `Saved as v${body.label} — waiting for review` });
    refreshDroneMatch();
  }

  return (
    <div className="flex flex-col gap-1">
      <BusyButton
        type="button"
        busy={saving}
        busyLabel="Saving…"
        icon={<Save className="h-3.5 w-3.5" />}
        onClick={save}
        className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary"
      >
        Save as new version
      </BusyButton>
      {result && (
        <p className={`text-[11px] ${result.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-300"}`}>{result.text}</p>
      )}
    </div>
  );
}

function LinkPicker({ match, onRegister }: Props) {
  const { autopilot } = useDroneParams();
  const [selected, setSelected] = useState(match.suggestedId ?? match.candidates[0]?.id ?? "");
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelected(match.suggestedId ?? match.candidates[0]?.id ?? "");
  }, [match.suggestedId, match.candidates]);

  const selectedSerial = match.candidates.find((c) => c.id === selected)?.serial ?? null;

  async function link() {
    if (!selected) return;
    setLinking(true);
    setError(null);
    const res = await fetch(`/api/admin/drones/${selected}/link`, {
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
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Link2 className="h-3.5 w-3.5 text-primary shrink-0" />
        This flight controller isn&apos;t linked yet. Which drone is it?
      </p>
      {match.candidates.length > 0 ? (
        <>
          <fieldset className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-1">
            <legend className="sr-only">Drone record</legend>
            {match.candidates.map((c) => {
              const inputId = `link-drone-${c.id}`;
              const isSelected = c.id === selected;
              return (
                <label
                  key={c.id}
                  htmlFor={inputId}
                  className={`flex items-start gap-2 rounded-md border px-2.5 py-2 cursor-pointer transition-colors ${
                    isSelected ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"
                  }`}
                >
                  <input
                    id={inputId}
                    type="radio"
                    name="link-drone"
                    value={c.id}
                    checked={isSelected}
                    onChange={() => setSelected(c.id)}
                    className="mt-0.5 cursor-pointer accent-primary"
                  />
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-mono text-xs font-medium text-foreground break-all">{c.serial}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {c.client_name ?? <span className="italic">no client</span>}
                      {c.family_name && ` · ${c.family_name}${c.variant_name ? ` / ${c.variant_name}` : ""}`}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      {c.id === match.suggestedId && (
                        <span className="rounded bg-emerald-500/15 px-1 py-px text-emerald-700 dark:text-emerald-300">
                          matches SCR_USER1
                        </span>
                      )}
                      <span className="text-muted-foreground">
                        {c.diff_count === null
                          ? "no version yet"
                          : c.diff_count === 0
                            ? "params identical to its latest version"
                            : `${c.diff_count} param${c.diff_count === 1 ? "" : "s"} differ from its latest version`}
                      </span>
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Check the serial on the airframe label before linking. The order is only a hint.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <BusyButton
              type="button"
              busy={linking}
              busyLabel="Linking…"
              icon={<Link2 className="h-3.5 w-3.5" />}
              onClick={link}
              disabled={!selected}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              {selectedSerial ? `Link to ${selectedSerial}` : "Link to this drone"}
            </BusyButton>
            {onRegister && (
              <button
                type="button"
                onClick={onRegister}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap"
              >
                It&apos;s a new drone — register it
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">No unlinked drone records.</p>
          {onRegister && (
            <button
              type="button"
              onClick={onRegister}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer whitespace-nowrap"
            >
              Register as a new drone
            </button>
          )}
        </div>
      )}
      {error && <p className="text-[11px] text-rose-700 dark:text-rose-300">{error}</p>}
    </div>
  );
}

/**
 * Who the connected drone is and how it compares with its history. In the
 * connect modal this is the update popup: for `update_available` it carries
 * the change list and the Apply button.
 */
export function DroneStatusPanel({ match, onRegister }: Props) {
  const { autopilot } = useDroneParams();
  const { role } = useAuth();
  const isStaff = role === "admin" || role === "contributor";
  const { drone, desired, pending, diff, state } = match;

  const identity: [string, React.ReactNode][] = [
    ["Chip ID", autopilot?.chipId
      ? <span className="font-mono break-all">{autopilot.chipId}</span>
      : <span className="italic text-muted-foreground">not reported</span>],
    ["Firmware", autopilot?.firmware ?? <span className="italic text-muted-foreground">unknown</span>],
  ];
  if (drone) {
    identity.push(["Serial", <span className="font-mono">{drone.serial}</span>]);
    identity.push(["Client", drone.client_name ?? <span className="italic text-muted-foreground">No client</span>]);
    if (drone.family_name) identity.push(["Family", drone.family_name]);
    if (drone.variant_name) identity.push(["Variant", drone.variant_name]);
  }

  return (
    <div className="rounded-md border border-border bg-secondary/50 px-3 py-2 flex flex-col gap-2">
      <div className="flex flex-col gap-0.5 text-xs">
        {identity.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <span className="text-muted-foreground shrink-0">{label}:</span>
            <span className="text-foreground min-w-0">{value}</span>
          </div>
        ))}
      </div>

      {match.status === "loading" && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground"><Spinner /> Checking against the catalog…</p>
      )}

      {match.status === "no_chip" && (
        <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
          The flight controller didn&apos;t report its chip ID (it needs MAVLink 2 on this port), so it can&apos;t be identified or updated.
        </p>
      )}

      {match.status === "error" && (
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs text-amber-700 dark:text-amber-400">Couldn&apos;t check against the catalog.</p>
          <button
            type="button"
            onClick={refreshDroneMatch}
            className="flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="h-3 w-3" /> Try again
          </button>
        </div>
      )}

      {match.status === "unlinked" && (isStaff
        ? <LinkPicker match={match} onRegister={onRegister} />
        : (
          <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
            This drone isn&apos;t set up for updates yet — contact AIR6.
          </p>
        ))}

      {match.status === "linked" && match.firmwareMismatch && desired && (
        <p className="flex items-start gap-1.5 text-xs text-rose-700 dark:text-rose-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
          v{desired.label} was made for ArduPilot {firmwareMinor(desired.firmware)}, this drone runs {firmwareMinor(match.droneFirmware)}.
        </p>
      )}

      {match.status === "linked" && state === "in_sync" && desired && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <CheckCircle className="h-3.5 w-3.5 shrink-0" /> In sync with v{desired.label}
        </p>
      )}

      {match.status === "linked" && state === "update_available" && desired && (
        <div className="flex flex-col gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
            <Bell className="h-3.5 w-3.5 shrink-0" />
            AIR6 has an update for this drone: v{desired.label} — {diff.length} param{diff.length === 1 ? "" : "s"} change
          </p>
          <DiffList diff={diff} versionLabel={desired.label} />
          <p className="text-[10px] text-muted-foreground leading-snug">
            Apply writes the stored v{desired.label} values to the drone.
          </p>
          <div><ApplyUpdateButton version={desired} label={`Apply v${desired.label}`} /></div>
        </div>
      )}

      {match.status === "linked" && (state === "modified" || state === "differs") && desired && (
        <div className="flex flex-col gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {state === "modified" ? "Modified on the drone: " : "Differs from v" + desired.label + ": "}
            {diff.length} param{diff.length === 1 ? "" : "s"}{state === "modified" ? ` differ from v${desired.label}` : ""}
          </p>
          <DiffList diff={diff} versionLabel={desired.label} />
          <p className="text-[10px] text-muted-foreground leading-snug">
            Restore writes the stored v{desired.label} values to the drone.
            {drone?.client_set_id && " Save as new version keeps the drone's values and stores them as the next version."}
          </p>
          <div className="flex items-start gap-2 flex-wrap">
            <ApplyUpdateButton version={desired} label={`Restore v${desired.label}`} />
            {drone?.client_set_id && <SaveAsNewVersionButton />}
          </div>
        </div>
      )}

      {match.status === "linked" && state === "pending_review" && pending && (
        <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Saved as v{pending.label} — waiting for review
        </p>
      )}

      {match.status === "linked" && state === "no_version" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">This drone&apos;s history has no approved version yet.</p>
          {drone?.client_set_id && <SaveAsNewVersionButton />}
        </div>
      )}
    </div>
  );
}
