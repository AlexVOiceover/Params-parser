import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { getCaller } from "@/lib/supabase/auth";
import { CHIP_ID_PATTERN } from "@/lib/chip-id";
import { diffDesired, toValueMap } from "@/lib/desired-state";

export const dynamic = "force-dynamic";

/**
 * POST /api/drone/events
 * Body: { chipId, firmware, versionId, params: { name, value }[] }
 *
 * Records a verified apply. `params` is the drone's state after the write,
 * with every written value as read back from the FC. The server recomputes the
 * diff against the version itself and only logs `applied` when it is empty —
 * the log never takes the browser's word for it.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json() as {
    chipId?: string;
    firmware?: string | null;
    versionId?: string;
    params?: { name: string; value: string }[];
  };
  const chipId = body.chipId?.toUpperCase() ?? "";
  if (!CHIP_ID_PATTERN.test(chipId) || !body.versionId || !Array.isArray(body.params)) {
    return NextResponse.json({ error: "chipId, versionId and params are required" }, { status: 400 });
  }

  const supabase = await createSessionClient();
  const { data: drone } = await supabase
    .from("drones")
    .select("id, variant_id, initialised_at")
    .eq("chip_id", chipId)
    .maybeSingle();
  if (!drone) return NextResponse.json({ error: "This flight controller is not linked to a drone" }, { status: 404 });

  // The version must belong to this drone's history (or its variant's Default for orphans).
  const { data: version } = await supabase
    .from("param_versions")
    .select("id, client_set_id, client_sets!inner(drone_id, variant_id, is_default)")
    .eq("id", body.versionId)
    .maybeSingle();
  const set = (version as { client_sets: { drone_id: string | null; variant_id: string; is_default: boolean } } | null)?.client_sets;
  const belongs = !!set && (set.drone_id === drone.id || (set.is_default && set.variant_id === drone.variant_id));
  if (!version || !belongs) {
    return NextResponse.json({ error: "That version is not in this drone's history" }, { status: 400 });
  }

  const desired = new Map<string, number>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("param_values")
      .select("name, value")
      .eq("param_version_id", body.versionId)
      .order("name")
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const row of data) {
      const v = parseFloat(row.value);
      if (Number.isFinite(v)) desired.set(row.name, v);
    }
    if (data.length < 1000) break;
  }

  const diff = diffDesired(desired, toValueMap(body.params));
  if (diff.length > 0) {
    return NextResponse.json(
      { error: `${diff.length} param${diff.length === 1 ? "" : "s"} still differ`, diff },
      { status: 409 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("drone_events").insert({
    drone_id: drone.id,
    created_by: caller.id,
    param_version_id: body.versionId,
    chip_id: chipId,
    firmware: body.firmware ?? null,
    kind: "applied",
    diff_count: 0,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // First verified config marks the drone as initialised (clients can't update drones directly).
  if (!drone.initialised_at) {
    await admin.from("drones").update({ initialised_at: new Date().toISOString() }).eq("id", drone.id);
  }

  return NextResponse.json({ ok: true });
}
