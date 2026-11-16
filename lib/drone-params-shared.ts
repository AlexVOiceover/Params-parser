/** Virtual version ID used in compare URLs to represent connected drone params. */
export const DRONE_VERSION_ID = "__drone__";
/** Legacy key — drone params used to persist here forever; now only purged. */
export const DRONE_STORAGE_KEY = "air6_drone_params";

// ── Snapshot chip ID ──────────────────────────────────────────────────────────
// The chip ID of the drone whose params are in the current snapshot. Every
// write session reads the plugged-in FC's chip ID and refuses to write unless
// it matches: the changes were computed against this snapshot.

let snapshotChipId: string | null = null;
const mismatchListeners = new Set<() => void>();

export function setSnapshotChipId(chipId: string | null): void {
  snapshotChipId = chipId;
}

export function getSnapshotChipId(): string | null {
  return snapshotChipId;
}

/** Called when a write finds a different drone plugged in than the one read. */
export function reportDroneMismatch(): void {
  snapshotChipId = null;
  for (const fn of mismatchListeners) fn();
}

export function onDroneMismatch(fn: () => void): () => void {
  mismatchListeners.add(fn);
  return () => { mismatchListeners.delete(fn); };
}
