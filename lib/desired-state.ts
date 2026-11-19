// Desired-state comparison: what a drone should have (a version in its
// history) against what it actually has (a live read). Shared by client and
// server so every status in the app comes from the same rules.

import type { Rule } from "@/lib/types";
import { matchesRule } from "@/lib/param-engine";
import unmanagedJson from "@/data/unmanaged-params.json";

type PerDroneCategory = "calibration" | "tuning" | "radio" | "hardware" | "identity" | "runtime";
type PerDroneRule = Rule & { category: PerDroneCategory; reason: string };

const UNMANAGED_RULES = (unmanagedJson as { rules: PerDroneRule[] }).rules;
const RUNTIME_RULES = UNMANAGED_RULES.filter((r) => r.category === "runtime");

/** Managed by default: a param is per-drone only if a rule in data/unmanaged-params.json matches it. */
export function isUnmanaged(name: string): boolean {
  return UNMANAGED_RULES.some((rule) => matchesRule(name, rule));
}

/** Params that change by themselves: left out of version-to-version change counts and Compare. */
export function isRuntime(name: string): boolean {
  return RUNTIME_RULES.some((rule) => matchesRule(name, rule));
}

/**
 * Equal when both round to the same float32 (what the drone stores), or when
 * they differ by no more than float32 precision — Mission Planner writes
 * ~7 significant digits, which may not round-trip to the exact same float32.
 */
export function paramsEqual(a: number, b: number): boolean {
  if (Math.fround(a) === Math.fround(b)) return true;
  return Math.abs(a - b) <= 1e-6 * Math.max(Math.abs(a), Math.abs(b));
}

export interface ParamDiff {
  name: string;
  desired: number;
  /** null when the drone does not have the param at all. */
  actual: number | null;
}

/** Build a name → value map from string-valued params (a drone read or a version). */
export function toValueMap(params: { name: string; value: string | number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const p of params) {
    const v = typeof p.value === "number" ? p.value : parseFloat(p.value);
    if (Number.isFinite(v)) map.set(p.name, v);
  }
  return map;
}

/**
 * Managed params in `desired` whose value on the drone differs, sorted by name.
 * A param missing on the drone counts as a difference; params the drone has
 * but the version doesn't list are ignored (Mission Planner files can be partial).
 */
export function diffDesired(desired: Map<string, number>, actual: Map<string, number>): ParamDiff[] {
  const diffs: ParamDiff[] = [];
  for (const [name, want] of desired) {
    if (isUnmanaged(name)) continue;
    const have = actual.get(name);
    if (have === undefined) diffs.push({ name, desired: want, actual: null });
    else if (!paramsEqual(have, want)) diffs.push({ name, desired: want, actual: have });
  }
  return diffs.sort((a, b) => a.name.localeCompare(b.name));
}

/** "4.5.7" → "4.5"; null when unknown. */
export function firmwareMinor(firmware: string | null): string | null {
  const m = firmware ? /^(\d+)\.(\d+)/.exec(firmware) : null;
  return m ? `${m[1]}.${m[2]}` : null;
}

/** True only when both are known and their major.minor differ. */
export function firmwareMismatch(versionFw: string | null, droneFw: string | null): boolean {
  const a = firmwareMinor(versionFw);
  const b = firmwareMinor(droneFw);
  return a !== null && b !== null && a !== b;
}

// ── Connected-drone status (shared by /api/drone/match and its hook) ──────────

/**
 * in_sync          — equals the desired version
 * update_available — still equals its last verified version; a newer one is desired
 * modified         — equals neither the desired nor its last verified version
 * differs          — not in sync and never verified (no event yet), so the two can't be told apart
 * pending_review   — equals a newer version that is waiting for review
 * no_version       — its history has no approved version yet
 */
export type DroneState = "in_sync" | "update_available" | "modified" | "differs" | "pending_review" | "no_version";

export interface VersionRef {
  id: string;
  label: string;
  firmware: string | null;
}

export interface MatchedDrone {
  id: string;
  serial: string;
  chip_id: string;
  client_id: string | null;
  variant_id: string;
  client_name: string | null;
  family_slug: string | null;
  family_name: string | null;
  variant_name: string | null;
  /** The drone's own history, or null when it has none and falls back to the Default. */
  client_set_id: string | null;
  /** The set whose versions are desired: own history, or the variant's Default for orphans. */
  history_set_id: string | null;
  is_orphan: boolean;
}

export interface LinkCandidate {
  id: string;
  serial: string;
  client_name: string | null;
  family_name: string | null;
  variant_name: string | null;
  /** Managed params differing from its latest version; null when it has none. */
  diff_count: number | null;
}

export type MatchResponse =
  | {
      linked: true;
      drone: MatchedDrone;
      state: DroneState;
      desired: VersionRef | null;
      pending: VersionRef | null;
      /** Version of the last verified applied/captured event. */
      lastVerified: VersionRef | null;
      diff: ParamDiff[];
      firmwareMismatch: boolean;
    }
  | {
      linked: false;
      /** Unlinked drone records for staff to pick from; empty for clients. */
      candidates: LinkCandidate[];
      /** Candidate pre-selected through the SCR_USER1 hint. */
      suggestedId: string | null;
    };
