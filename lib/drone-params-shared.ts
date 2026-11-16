/** Virtual version ID used in compare URLs to represent connected drone params. */
export const DRONE_VERSION_ID = "__drone__";
/** Legacy key — drone params used to persist here forever; now only purged. */
export const DRONE_STORAGE_KEY = "air6_drone_params";

// ── Drone identity ────────────────────────────────────────────────────────────
// Params that tell one airframe from another without changing between a read
// and a write: the registered serial, the boot/flight counters (stable while
// powered and disarmed) and the per-unit calibration offsets. Before any write
// the plugged-in drone must report the same values as the drone that was read.

export const IDENTITY_PARAMS = [
  "SCR_USER1",
  "STAT_BOOTCNT",
  "STAT_FLTTIME",
  "INS_ACCOFFS_X",
  "INS_ACCOFFS_Y",
  "INS_ACCOFFS_Z",
  "COMPASS_OFS_X",
  "COMPASS_OFS_Y",
  "COMPASS_OFS_Z",
] as const;

let identity: Map<string, number> | null = null;
const mismatchListeners = new Set<() => void>();

export function rememberDroneIdentity(params: { name: string; value: string }[]): void {
  const next = new Map<string, number>();
  for (const name of IDENTITY_PARAMS) {
    const p = params.find((x) => x.name === name);
    if (p) next.set(name, parseFloat(p.value));
  }
  identity = next;
}

export function getDroneIdentity(): ReadonlyMap<string, number> | null {
  return identity;
}

/** Keep the identity in step with params this app just wrote (e.g. SCR_USER1 on registration). */
export function updateDroneIdentity(written: { name: string; value: number }[]): void {
  if (!identity) return;
  for (const { name, value } of written) {
    if (identity.has(name)) identity.set(name, value);
  }
}

export function forgetDroneIdentity(): void {
  identity = null;
}

/** Called when a write finds a different drone plugged in than the one read. */
export function reportDroneMismatch(): void {
  identity = null;
  for (const fn of mismatchListeners) fn();
}

export function onDroneMismatch(fn: () => void): () => void {
  mismatchListeners.add(fn);
  return () => { mismatchListeners.delete(fn); };
}

export function sameParamValue(a: number, b: number): boolean {
  return Math.abs(a - b) / Math.max(Math.abs(b), 1e-10) < 1e-5;
}
