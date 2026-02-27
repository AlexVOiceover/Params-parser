import type { Param, Rule, ProtectionList, ParamGroup } from "./types";

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
 * Default protection lists (embedded so no filesystem needed).
 */
export const DEFAULT_PROTECTION_LISTS: ProtectionList[] = [
  {
    name: "Calibration Parameters",
    description:
      "Sensor calibration data that is specific to each physical drone (IMU offsets, compass calibration, barometer ground pressure, motor hover thrust). These should never be overwritten from another drone.",
    rules: [
      { type: "prefix", value: "COMPASS_OFS" },
      { type: "prefix", value: "COMPASS_DIA" },
      { type: "prefix", value: "COMPASS_MOT" },
      { type: "prefix", value: "COMPASS_ODI" },
      { type: "prefix", value: "COMPASS_SCALE" },
      { type: "prefix", value: "INS_ACCOFFS" },
      { type: "prefix", value: "INS_ACCSCAL" },
      { type: "prefix", value: "INS_GYROFFS" },
      { type: "prefix", value: "INS_ACC1_CALTEMP" },
      { type: "prefix", value: "INS_ACC2_CALTEMP" },
      { type: "prefix", value: "INS_ACC3_CALTEMP" },
      { type: "prefix", value: "INS_GYR1_CALTEMP" },
      { type: "prefix", value: "INS_GYR2_CALTEMP" },
      { type: "prefix", value: "INS_GYR3_CALTEMP" },
      { type: "prefix", value: "INS_ACC2OFFS" },
      { type: "prefix", value: "INS_ACC2SCAL" },
      { type: "prefix", value: "INS_ACC3OFFS" },
      { type: "prefix", value: "INS_ACC3SCAL" },
      { type: "prefix", value: "INS_GYR2OFFS" },
      { type: "prefix", value: "INS_GYR3OFFS" },
      { type: "prefix", value: "BARO1_GND" },
      { type: "prefix", value: "BARO2_GND" },
      { type: "prefix", value: "BARO3_GND" },
      { type: "exact", value: "AHRS_TRIM_X" },
      { type: "exact", value: "AHRS_TRIM_Y" },
      { type: "exact", value: "AHRS_TRIM_Z" },
      { type: "exact", value: "MOT_THST_HOVER" },
    ],
  },
  {
    name: "Hardware & Device IDs",
    description:
      "Hardware-specific identifiers, board type, device IDs, serial port configuration, and runtime statistics. These are unique to each physical unit and should not be transferred between drones.",
    rules: [
      { type: "prefix", value: "COMPASS_DEV_ID" },
      { type: "prefix", value: "COMPASS_PRIO" },
      { type: "exact", value: "INS_GYR_ID" },
      { type: "exact", value: "INS_GYR2_ID" },
      { type: "exact", value: "INS_GYR3_ID" },
      { type: "exact", value: "INS_ACC_ID" },
      { type: "exact", value: "INS_ACC2_ID" },
      { type: "exact", value: "INS_ACC3_ID" },
      { type: "prefix", value: "INS4_" },
      { type: "prefix", value: "INS5_" },
      { type: "exact", value: "BARO1_DEVID" },
      { type: "exact", value: "BARO2_DEVID" },
      { type: "exact", value: "BARO3_DEVID" },
      { type: "prefix", value: "STAT_" },
      { type: "exact", value: "SYSID_THISMAV" },
      { type: "exact", value: "BRD_SERIAL_NUM" },
      { type: "exact", value: "BRD_TYPE" },
      { type: "exact", value: "FORMAT_VERSION" },
      { type: "prefix", value: "SERIAL0_" },
      { type: "prefix", value: "SERIAL1_" },
      { type: "prefix", value: "SERIAL2_" },
      { type: "prefix", value: "SERIAL3_" },
      { type: "prefix", value: "SERIAL4_" },
      { type: "prefix", value: "SERIAL5_" },
      { type: "prefix", value: "SERIAL6_" },
    ],
  },
  {
    name: "RC Configuration",
    description:
      "Radio control calibration (min/max/trim per channel) and channel mapping. These are specific to each operator's transmitter and should not be applied to drones used by different pilots.",
    rules: [
      { type: "prefix", value: "RC1_" },
      { type: "prefix", value: "RC2_" },
      { type: "prefix", value: "RC3_" },
      { type: "prefix", value: "RC4_" },
      { type: "prefix", value: "RC5_" },
      { type: "prefix", value: "RC6_" },
      { type: "prefix", value: "RC7_" },
      { type: "prefix", value: "RC8_" },
      { type: "prefix", value: "RC9_" },
      { type: "prefix", value: "RC10_" },
      { type: "prefix", value: "RC11_" },
      { type: "prefix", value: "RC12_" },
      { type: "prefix", value: "RC13_" },
      { type: "prefix", value: "RC14_" },
      { type: "prefix", value: "RC15_" },
      { type: "prefix", value: "RC16_" },
      { type: "prefix", value: "RCMAP_" },
    ],
  },
];
