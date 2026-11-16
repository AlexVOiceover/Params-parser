import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getCaller } from "@/lib/supabase/auth";
import { parseSerialId } from "@/lib/param-engine";
import { CHIP_ID_PATTERN } from "@/lib/chip-id";
import {
  diffDesired,
  firmwareMismatch,
  toValueMap,
  type DroneState,
  type LinkCandidate,
  type MatchResponse,
  type VersionRef,
} from "@/lib/desired-state";

export const dynamic = "force-dynamic";

type Supabase = Awaited<ReturnType<typeof createSessionClient>>;

interface VersionRow {
  id: string;
  client_set_id: string;
  version_label: string;
  firmware: string | null;
  needs_review: boolean;
}

const byLabelDesc = (a: VersionRow, b: VersionRow) =>
  parseInt(b.version_label, 10) - parseInt(a.version_label, 10);

const ref = (v: VersionRow): VersionRef => ({ id: v.id, label: v.version_label, firmware: v.firmware });

/** Param values for several versions at once, paginated past the 1000-row cap. */
async function loadValues(supabase: Supabase, versionIds: string[]): Promise<Map<string, Map<string, number>>> {
  const out = new Map<string, Map<string, number>>();
  for (const id of versionIds) out.set(id, new Map());
  if (versionIds.length === 0) return out;
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("param_values")
      .select("param_version_id, name, value")
      .in("param_version_id", versionIds)
      .order("param_version_id")
      .order("name")
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const row of data as { param_version_id: string; name: string; value: string }[]) {
      const v = parseFloat(row.value);
      if (Number.isFinite(v)) out.get(row.param_version_id)?.set(row.name, v);
    }
    if (data.length < 1000) break;
  }
  return out;
}

/** Latest approved version per set (the desired one), keyed by set id. */
function latestApproved(rows: VersionRow[]): Map<string, VersionRow> {
  const out = new Map<string, VersionRow>();
  for (const v of [...rows].sort(byLabelDesc)) {
    if (!v.needs_review && !out.has(v.client_set_id)) out.set(v.client_set_id, v);
  }
  return out;
}

/**
 * POST /api/drone/match
 * Body: { chipId, firmware, params: { name, value }[], scrUser1Hint }
 *
 * Identifies the connected drone by its FC chip ID and judges it by comparing
 * its live params with the latest approved version in its history. Nothing the
 * drone reports about itself (SCR_USER*) is trusted; SCR_USER1 only pre-selects
 * a record when staff link an unknown chip.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json() as {
    chipId?: string | null;
    firmware?: string | null;
    params?: { name: string; value: string }[];
    scrUser1Hint?: number | null;
  };
  const chipId = body.chipId?.toUpperCase() ?? "";
  if (!CHIP_ID_PATTERN.test(chipId) || !Array.isArray(body.params)) {
    return NextResponse.json({ error: "A chip ID and params are required" }, { status: 400 });
  }
  const actual = toValueMap(body.params);
  const isStaff = caller.role === "admin" || caller.role === "contributor";
  const supabase = await createSessionClient();

  const { data: drone } = await supabase
    .from("drones")
    .select("id, serial, chip_id, client_id, variant_id")
    .eq("chip_id", chipId)
    .maybeSingle();

  if (!drone) {
    const response: MatchResponse = isStaff
      ? await linkCandidates(supabase, actual, body.scrUser1Hint ?? null)
      : { linked: false, candidates: [], suggestedId: null };
    return NextResponse.json(response);
  }

  const [{ data: client }, { data: variant }, { data: ownSets }] = await Promise.all([
    drone.client_id
      ? supabase.from("clients").select("name").eq("id", drone.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("variants").select("name, family_id").eq("id", drone.variant_id).maybeSingle(),
    supabase
      .from("client_sets")
      .select("id")
      .eq("drone_id", drone.id)
      .eq("variant_id", drone.variant_id)
      .eq("is_default", false),
  ]);

  const { data: family } = variant?.family_id
    ? await supabase.from("families").select("slug, name").eq("id", variant.family_id).maybeSingle()
    : { data: null };

  // A drone without its own history follows the variant's Default.
  const ownSetId = ownSets?.[0]?.id ?? null;
  const historySetId = ownSetId ?? (await supabase
    .from("client_sets")
    .select("id")
    .eq("variant_id", drone.variant_id)
    .eq("is_default", true)
    .maybeSingle()).data?.id ?? null;

  const [{ data: versionRows }, { data: lastEvent }] = await Promise.all([
    historySetId
      ? supabase
          .from("param_versions")
          .select("id, client_set_id, version_label, firmware, needs_review")
          .eq("client_set_id", historySetId)
      : Promise.resolve({ data: [] as VersionRow[] }),
    supabase
      .from("drone_events")
      .select("param_version_id")
      .eq("drone_id", drone.id)
      .in("kind", ["applied", "captured"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const versions = ((versionRows ?? []) as VersionRow[]).sort(byLabelDesc);
  const desiredRow = versions.find((v) => !v.needs_review) ?? null;
  const pendingRow = versions.find((v) =>
    v.needs_review && (!desiredRow || parseInt(v.version_label, 10) > parseInt(desiredRow.version_label, 10))
  ) ?? null;

  let lastRow: VersionRow | null = null;
  const lastId = (lastEvent as { param_version_id: string | null } | null)?.param_version_id ?? null;
  if (lastId) {
    lastRow = versions.find((v) => v.id === lastId) ?? (await supabase
      .from("param_versions")
      .select("id, client_set_id, version_label, firmware, needs_review")
      .eq("id", lastId)
      .maybeSingle()).data as VersionRow | null;
  }

  const ids = [...new Set([desiredRow?.id, pendingRow?.id, lastRow?.id].filter((x): x is string => !!x))];
  const values = await loadValues(supabase, ids);
  const diffAgainst = (row: VersionRow | null) => (row ? diffDesired(values.get(row.id) ?? new Map(), actual) : null);

  const diff = diffAgainst(desiredRow) ?? [];
  let state: DroneState;
  if (!desiredRow) {
    state = pendingRow && diffAgainst(pendingRow)?.length === 0 ? "pending_review" : "no_version";
  } else if (diff.length === 0) {
    state = "in_sync";
  } else if (pendingRow && diffAgainst(pendingRow)?.length === 0) {
    state = "pending_review";
  } else if (!lastRow) {
    state = "differs";
  } else if (lastRow.id !== desiredRow.id && diffAgainst(lastRow)?.length === 0) {
    state = "update_available";
  } else {
    state = "modified";
  }

  const response: MatchResponse = {
    linked: true,
    drone: {
      id: drone.id,
      serial: drone.serial,
      chip_id: chipId,
      client_id: drone.client_id,
      variant_id: drone.variant_id,
      client_name: client?.name ?? null,
      family_slug: family?.slug ?? null,
      family_name: family?.name ?? null,
      variant_name: variant?.name ?? null,
      client_set_id: ownSetId,
      history_set_id: historySetId,
      is_orphan: !ownSetId,
    },
    state,
    desired: desiredRow ? ref(desiredRow) : null,
    pending: pendingRow ? ref(pendingRow) : null,
    lastVerified: lastRow ? ref(lastRow) : null,
    diff,
    firmwareMismatch: firmwareMismatch(desiredRow?.firmware ?? null, body.firmware ?? null),
  };
  return NextResponse.json(response);
}

/**
 * Unlinked drone records for staff to choose from. The SCR_USER1 match is
 * pre-selected; the rest are ordered by how close their latest version is to
 * the params just read. Ordering is only a hint — staff confirm by the label.
 */
async function linkCandidates(
  supabase: Supabase,
  actual: Map<string, number>,
  scrUser1Hint: number | null
): Promise<MatchResponse> {
  const { data: drones } = await supabase
    .from("drones")
    .select("id, serial, client_id, variant_id")
    .is("chip_id", null);
  const list = drones ?? [];
  if (list.length === 0) return { linked: false, candidates: [], suggestedId: null };

  const droneIds = list.map((d) => d.id);
  const clientIds = [...new Set(list.map((d) => d.client_id).filter((x): x is string => !!x))];
  const variantIds = [...new Set(list.map((d) => d.variant_id))];

  const [{ data: clients }, { data: variants }, { data: sets }] = await Promise.all([
    clientIds.length
      ? supabase.from("clients").select("id, name").in("id", clientIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase.from("variants").select("id, name, family_id").in("id", variantIds),
    supabase.from("client_sets").select("id, drone_id").in("drone_id", droneIds).eq("is_default", false),
  ]);
  const familyIds = [...new Set((variants ?? []).map((v) => v.family_id).filter((x): x is string => !!x))];
  const { data: families } = familyIds.length
    ? await supabase.from("families").select("id, name").in("id", familyIds)
    : { data: [] as { id: string; name: string }[] };

  const setIds = (sets ?? []).map((s) => s.id);
  const { data: versionRows } = setIds.length
    ? await supabase
        .from("param_versions")
        .select("id, client_set_id, version_label, firmware, needs_review")
        .in("client_set_id", setIds)
    : { data: [] as VersionRow[] };
  const latest = latestApproved((versionRows ?? []) as VersionRow[]);
  const values = await loadValues(supabase, [...latest.values()].map((v) => v.id));

  const setByDrone = new Map((sets ?? []).map((s) => [s.drone_id as string, s.id as string]));
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));
  const familyName = new Map((families ?? []).map((f) => [f.id, f.name]));

  const candidates: LinkCandidate[] = list.map((d) => {
    const setId = setByDrone.get(d.id);
    const version = setId ? latest.get(setId) : undefined;
    const variant = variantById.get(d.variant_id);
    return {
      id: d.id,
      serial: d.serial,
      client_name: d.client_id ? clientName.get(d.client_id) ?? null : null,
      family_name: variant?.family_id ? familyName.get(variant.family_id) ?? null : null,
      variant_name: variant?.name ?? null,
      diff_count: version ? diffDesired(values.get(version.id) ?? new Map(), actual).length : null,
    };
  });

  const hinted = scrUser1Hint
    ? list.filter((d) => parseSerialId(d.serial) === scrUser1Hint)
    : [];
  const suggestedId = hinted.length === 1 ? hinted[0].id : null;

  candidates.sort((a, b) => {
    if (a.id === suggestedId) return -1;
    if (b.id === suggestedId) return 1;
    if (a.diff_count !== b.diff_count) {
      if (a.diff_count === null) return 1;
      if (b.diff_count === null) return -1;
      return a.diff_count - b.diff_count;
    }
    return a.serial.localeCompare(b.serial);
  });

  return { linked: false, candidates, suggestedId };
}
