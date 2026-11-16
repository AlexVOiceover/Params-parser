// Version rules shared by pages, routes and components. A version's number is
// assigned by the server; "latest" is always derived from the numbers, never
// from a stored flag, so every screen agrees on it.

export interface VersionLike {
  id: string;
  version_label: string;
  needs_review: boolean;
}

const num = (v: VersionLike): number => parseInt(v.version_label, 10) || 0;

/** The approved version with the highest number: the target a drone should be on. */
export function latestApproved<T extends VersionLike>(versions: T[]): T | null {
  let best: T | null = null;
  for (const v of versions) if (!v.needs_review && (!best || num(v) > num(best))) best = v;
  return best;
}

/** A proposal waiting for review that is newer than the target. */
export function pendingProposal<T extends VersionLike>(versions: T[]): T | null {
  const target = latestApproved(versions);
  let best: T | null = null;
  for (const v of versions) {
    if (v.needs_review && (!target || num(v) > num(target)) && (!best || num(v) > num(best))) best = v;
  }
  return best;
}

/** The next free version number. */
export function nextLabel(versions: { version_label: string }[]): string {
  return String(Math.max(0, ...versions.map((v) => parseInt(v.version_label, 10)).filter(Number.isFinite)) + 1);
}

/** URL of a drone's page. */
export function droneHref(serial: string): string {
  return `/drones/${encodeURIComponent(serial)}`;
}

/** URL of a model's page (its template and drones). */
export function modelHref(variantId: string): string {
  return `/models/${variantId}`;
}
