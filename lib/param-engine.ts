import type { Param, Rule, ProtectionList, ParamGroup, ParamDefinition } from "./types";
import defaultListsJson from "@/data/protection-lists.json";
import volatileParamsJson from "@/data/volatile-params.json";
import lockedParamsJson from "@/data/locked-params.json";

/**
 * ArduPilot runtime/volatile params excluded from version diffs and drone
 * writes. Sourced from data/volatile-params.json — edit that file to add
 * or remove entries without touching TypeScript.
 */
export const RUNTIME_PARAMS = new Set(
  (volatileParamsJson as { params: { name: string }[] }).params.map((p) => p.name)
);

/**
 * Params that are shown in diffs and compare but cannot be manually edited.
 * Managed automatically by the app or system-critical.
 */
export const LOCKED_PARAMS = new Set(
  (lockedParamsJson as { params: { name: string }[] }).params.map((p) => p.name)
);

/**
 * Extract the trailing integer from a drone serial string, used to match the
 * `SCR_USER1` parameter the firmware writes to identify itself. Examples:
 *   AIR4-0426-0023 → 23
 *   2012           → 2012
 *   001            → 1
 *   00A            → null  (no trailing digits)
 */
export function parseSerialId(serial: string): number | null {
  const match = /(\d+)\s*$/.exec(serial);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a .param file content string into a list of Param objects.
 * Format: PARAM_NAME,VALUE (one per line, # for comments)
 */
export function parseParamFile(content: string): Param[] {
  const params: Param[] = [];
  const lines = content.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const commaIdx = line.indexOf(",");
    if (commaIdx < 0) continue;
    const name = line.slice(0, commaIdx).trim();
    const value = line.slice(commaIdx + 1).trim();
    if (name) {
      params.push({ name, value });
    }
  }
  return params;
}

/**
 * Write params back to .param file format string.
 */
export function writeParamFile(params: Param[]): string {
  return params.map((p) => `${p.name},${p.value}`).join("\n") + "\n";
}

/**
 * Check if a param name matches a rule.
 */
export function matchesRule(paramName: string, rule: Rule): boolean {
  if (rule.type === "exact") return paramName === rule.value;
  if (rule.type === "prefix") return paramName.startsWith(rule.value);
  return false;
}

/**
 * Split params into protected and remaining based on rules.
 */
export function applyFilter(
  params: Param[],
  rules: Rule[]
): { protected: Param[]; remaining: Param[] } {
  const protectedParams: Param[] = [];
  const remaining: Param[] = [];
  for (const param of params) {
    if (rules.some((rule) => matchesRule(param.name, rule))) {
      protectedParams.push(param);
    } else {
      remaining.push(param);
    }
  }
  return { protected: protectedParams, remaining };
}

/**
 * Resolve which ArduPilot pdef group a param belongs to.
 * Matches the longest pdef group prefix.
 */
function resolveGroup(name: string, pdefGroups: string[]): string {
  let bestLen = 0;
  let best = "";
  for (const g of pdefGroups) {
    const gPrefix = g.replace(/_$/, "");
    if (!gPrefix) continue;
    if (name === gPrefix || name.startsWith(gPrefix + "_")) {
      if (gPrefix.length > bestLen) {
        bestLen = gPrefix.length;
        best = gPrefix;
      }
    }
  }
  if (best) return best;
  return name.includes("_") ? name.split("_")[0] : name;
}

/**
 * Build grouped params from a flat list.
 */
export function buildGroups(
  params: Param[],
  pdefGroups: string[]
): ParamGroup[] {
  const map: Record<string, Param[]> = {};
  for (const param of params) {
    const g = resolveGroup(param.name, pdefGroups);
    if (!map[g]) map[g] = [];
    map[g].push(param);
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, params]) => ({ label, params }));
}

/**
 * Default protection lists loaded from data/protection-lists.json.
 */
export const DEFAULT_PROTECTION_LISTS: ProtectionList[] =
  defaultListsJson as ProtectionList[];

/**
 * Validate a param value against its ArduPilot definition.
 * Returns null if valid (or no constraints to check), or a reason string if invalid.
 */
export function validateParam(value: string, def: ParamDefinition): string | null {
  const num = parseFloat(value);
  const isNum = !isNaN(num);

  // Range takes priority — definitive numeric constraint
  if (def.Range) {
    if (!isNum) return "Not a number";
    const lo = parseFloat(def.Range.low);
    const hi = parseFloat(def.Range.high);
    if (num >= lo && num <= hi) return null;
    // Some params document special out-of-range states in their Values map (e.g. 0 = Disabled).
    if (def.Values && Object.keys(def.Values).some((k) => Math.abs(parseFloat(k) - num) < 0.001)) return null;
    return `Out of range ${def.Range.low} – ${def.Range.high}`;
  }

  // Values (strict enum) — only when no Range is defined
  if (def.Values && Object.keys(def.Values).length > 0) {
    if (!isNum) return "Not a number";
    const keys = Object.keys(def.Values);
    const isValid = keys.some((k) => Math.abs(parseFloat(k) - num) < 0.001);
    if (isValid) return null;
    return `Must be one of: ${keys.join(", ")}`;
  }

  // Bitmask — must be a non-negative integer
  if (def.Bitmask && Object.keys(def.Bitmask).length > 0) {
    if (!isNum || num < 0 || Math.abs(num - Math.round(num)) > 0.001) {
      return "Must be a non-negative integer";
    }
  }

  return null;
}

/**
 * Compare two ArduPilot param values for equivalence, accounting for the
 * 32-bit float precision loss that occurs when values transit MAVLink.
 *
 * ArduPilot stores params as 32-bit IEEE 754 floats. When transmitted over
 * MAVLink and then printed to full double precision they gain spurious digits
 * (e.g. 0.3 → 0.30000001192092896). Our catalog stores the human-readable
 * value (e.g. "0.3"). A relative tolerance of 1e-5 treats these as equal
 * while still detecting genuine configuration differences.
 *
 * For non-numeric values (e.g. empty string) falls back to strict equality.
 */
export function paramValuesEqual(a: string, b: string): boolean {
  if (a === b) return true;
  const na = parseFloat(a);
  const nb = parseFloat(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  if (na === 0 && nb === 0) return true;
  // Relative tolerance: handles both large and small values correctly
  const rel = Math.abs(na - nb) / Math.max(Math.abs(na), Math.abs(nb));
  return rel < 1e-5;
}
