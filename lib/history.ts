import { createAdminClient, type createSessionClient } from "@/lib/supabase/server";
import { isRuntime, isUnmanaged, paramsEqual } from "@/lib/desired-state";
import { latestApproved } from "@/lib/versions";
import type { DroneEventKind, LinkMethod } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createSessionClient>>;

export interface TimelineVersion {
  id: string;
  label: string;
  changelog: string | null;
  createdAt: string;
  author: string | null;
  needsReview: boolean;
  firmware: string | null;
  /** Params changed against the previous version (runtime counters ignored); null for the first. */
  changes: number | null;
  /** Previous version's id, for "compare with previous". */
  prevId: string | null;
}

export interface TimelineEvent {
  id: string;
  kind: DroneEventKind;
  label: string | null;
  versionId: string | null;
  actor: string | null;
  firmware: string | null;
  chipId: string | null;
  method: LinkMethod | null;
  createdAt: string;
}

async function values(supabase: Supabase, versionId: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from("param_values").select("name, value").eq("param_version_id", versionId).order("name").range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const r of data) {
      const v = parseFloat(r.value);
      if (Number.isFinite(v)) out.set(r.name, v);
    }
    if (data.length < 1000) break;
  }
  return out;
}

/** Display names for user ids. Profiles are owner-only under RLS; names are display-only here. */
async function names(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  if (unique.length === 0) return new Map();
  const { data } = await createAdminClient().from("profiles").select("id, username").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id, p.username]));
}

/** A set's versions, newest first, with change counts against their predecessor. */
export async function getVersions(supabase: Supabase, setId: string | null): Promise<TimelineVersion[]> {
  if (!setId) return [];
  const { data } = await supabase
    .from("param_versions")
    .select("id, version_label, changelog, created_at, created_by, needs_review, firmware")
    .eq("client_set_id", setId);
  const rows = (data ?? []).sort((a, b) => parseInt(a.version_label, 10) - parseInt(b.version_label, 10));
  const maps = await Promise.all(rows.map((r) => values(supabase, r.id)));
  const authors = await names(rows.map((r) => r.created_by));

  return rows.map((r, i) => {
    let changes: number | null = null;
    if (i > 0) {
      const prev = maps[i - 1];
      const cur = maps[i];
      changes = 0;
      for (const name of new Set([...prev.keys(), ...cur.keys()])) {
        if (isRuntime(name)) continue;
        const a = prev.get(name);
        const b = cur.get(name);
        if (a === undefined || b === undefined || !paramsEqual(a, b)) changes++;
      }
    }
    return {
      id: r.id,
      label: r.version_label,
      changelog: r.changelog,
      createdAt: r.created_at,
      author: r.created_by ? authors.get(r.created_by) ?? null : null,
      needsReview: r.needs_review,
      firmware: r.firmware,
      changes,
      prevId: i > 0 ? rows[i - 1].id : null,
    };
  }).reverse();
}

/** The drone's log, newest first, with version labels and who did it. */
export async function getEvents(supabase: Supabase, droneId: string): Promise<TimelineEvent[]> {
  const { data } = await supabase
    .from("drone_events")
    .select("id, param_version_id, chip_id, firmware, kind, method, created_by, created_at")
    .eq("drone_id", droneId)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const versionIds = [...new Set(rows.map((r) => r.param_version_id).filter((id): id is string => !!id))];
  const { data: labels } = versionIds.length
    ? await supabase.from("param_versions").select("id, version_label").in("id", versionIds)
    : { data: [] as { id: string; version_label: string }[] };
  const labelById = new Map((labels ?? []).map((l) => [l.id, l.version_label]));
  const actors = await names(rows.map((r) => r.created_by));

  return rows.map((r) => ({
    id: r.id,
    kind: r.kind as DroneEventKind,
    label: r.param_version_id ? labelById.get(r.param_version_id) ?? null : null,
    versionId: r.param_version_id,
    actor: r.created_by ? actors.get(r.created_by) ?? null : null,
    firmware: r.firmware,
    chipId: r.chip_id,
    method: r.method as LinkMethod | null,
    createdAt: r.created_at,
  }));
}

/**
 * For each drone, how many managed params of its target differ from the model
 * template's target. Per-drone params are ignored. Drones without a target are left out.
 */
export async function diffFromTemplate(supabase: Supabase, template: TimelineVersion[], droneIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const templateTarget = latestApproved(template.map((v) => ({ id: v.id, version_label: v.label, needs_review: v.needsReview })));
  if (!templateTarget || droneIds.length === 0) return out;
  const { data: sets } = await supabase.from("client_sets").select("id, drone_id").in("drone_id", droneIds).eq("is_default", false);
  const setIds = (sets ?? []).map((s) => s.id);
  if (setIds.length === 0) return out;
  const { data: versions } = await supabase.from("param_versions").select("id, client_set_id, version_label, needs_review").in("client_set_id", setIds);
  const base = await values(supabase, templateTarget.id);
  await Promise.all((sets ?? []).map(async (set) => {
    const target = latestApproved((versions ?? []).filter((v) => v.client_set_id === set.id));
    if (!target || !set.drone_id) return;
    const mine = await values(supabase, target.id);
    let n = 0;
    for (const name of new Set([...base.keys(), ...mine.keys()])) {
      if (isUnmanaged(name)) continue;
      const a = base.get(name);
      const b = mine.get(name);
      if (a === undefined || b === undefined || !paramsEqual(a, b)) n++;
    }
    out.set(set.drone_id, n);
  }));
  return out;
}
