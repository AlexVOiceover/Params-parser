import { writeDroneParams, type AutopilotInfo, type ParamWriteResult } from "@/lib/mavlink-serial";
import { createClient } from "@/lib/supabase/client";
import { diffDesired, toValueMap } from "@/lib/desired-state";

const BAUD_RATE = 115200;

export interface WriteOutcome {
  /** True only when every change was read back with the requested value (and, for an apply, logged). */
  ok: boolean;
  /** Per param, decided by reading the drone back — nothing is assumed written. */
  results: ParamWriteResult[];
  /** The drone's params after the write: the snapshot with every read-back value merged in. */
  params: { name: string; value: string }[];
  /** Set when the write never ran, or the apply could not be verified/logged. */
  error?: string;
}

/** Write `changes`, then read each one back. */
export function writeVerified(
  changes: { name: string; value: number }[],
  snapshot: { name: string; value: string }[],
  onLog: (msg: string) => void
): Promise<WriteOutcome> {
  return new Promise((resolve) => {
    void writeDroneParams(BAUD_RATE, changes, {
      onProgress: () => {},
      onLog,
      onDone: (results) => {
        const readBack = new Map(
          results.filter((r) => r.actual !== undefined).map((r) => [r.name, String(r.actual)])
        );
        const params = snapshot.map((p) => (readBack.has(p.name) ? { name: p.name, value: readBack.get(p.name)! } : p));
        for (const [name, value] of readBack) if (!snapshot.some((p) => p.name === name)) params.push({ name, value });
        resolve({ ok: results.every((r) => r.success), results, params });
      },
      onError: (msg) => resolve({ ok: false, results: [], params: snapshot, error: msg }),
    });
  });
}

/** A version's params, paginated past the 1000-row cap. */
export async function fetchVersionValues(versionId: string): Promise<Map<string, number>> {
  const supabase = createClient();
  const rows: { name: string; value: string }[] = [];
  if (!supabase) return new Map();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("param_values")
      .select("name, value")
      .eq("param_version_id", versionId)
      .order("name")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return toValueMap(rows);
}

/** The managed params that must change for the drone to equal `desired`. */
export function changesFor(desired: Map<string, number>, snapshot: { name: string; value: string }[]): { name: string; value: number }[] {
  return diffDesired(desired, toValueMap(snapshot)).map((d) => ({ name: d.name, value: d.desired }));
}

/**
 * Bring the drone to a version of its history: write the differing managed
 * params, read them back, then have the server recompute the diff from the
 * read-back state and log `applied` only if it is empty.
 */
export async function applyVersion(
  versionId: string,
  versionLabel: string,
  desired: Map<string, number>,
  snapshot: { name: string; value: string }[],
  autopilot: AutopilotInfo | null,
  onLog: (msg: string) => void
): Promise<WriteOutcome> {
  const changes = changesFor(desired, snapshot);
  const outcome: WriteOutcome = changes.length > 0
    ? await writeVerified(changes, snapshot, onLog)
    : { ok: true, results: [], params: snapshot };
  if (!outcome.ok) return outcome;

  const res = await fetch("/api/drone/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chipId: autopilot?.chipId,
      firmware: autopilot?.firmware ?? null,
      versionId,
      params: outcome.params,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    const error = `Written, but not confirmed as v${versionLabel}: ${body.error ?? "the server refused it"}`;
    onLog(`⚠ ${error}`);
    return { ...outcome, ok: false, error };
  }
  onLog(`✓ Verified — logged as v${versionLabel} applied`);
  return outcome;
}
