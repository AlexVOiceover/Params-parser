import type { Param, Rule, ProtectionList, ParamGroup, ParamDefinition } from "./types";
import defaultListsJson from "@/data/protection-lists.json";

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
