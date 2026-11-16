import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { getCaller } from "@/lib/supabase/auth";
import { CHIP_ID_PATTERN } from "@/lib/chip-id";
import { writeParamFile } from "@/lib/param-engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/drone/versions
 * Body: { chipId, firmware, params: { name, value }[], changelog? }
 *
 * "Save as new version" — anyone who can see the drone. Creates the next
 * version in the drone's own history from a live read. An admin's save is
 * approved at once; anyone else's waits for review. The version equals the
 * read by construction, so it is logged as `captured`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json() as {
    chipId?: string;
    firmware?: string | null;
    params?: { name: string; value: string }[];
    changelog?: string;
  };
  const chipId = body.chipId?.toUpperCase() ?? "";
  if (!CHIP_ID_PATTERN.test(chipId) || !Array.isArray(body.params) || body.params.length === 0) {
    return NextResponse.json({ error: "chipId and params are required" }, { status: 400 });
  }

  // Authorise through the caller's session: RLS decides whether they can see this drone.
  const supabase = await createSessionClient();
  const { data: drone } = await supabase
    .from("drones")
    .select("id, serial, variant_id")
    .eq("chip_id", chipId)
    .maybeSingle();
  if (!drone) return NextResponse.json({ error: "This flight controller is not linked to a drone" }, { status: 404 });

  const { data: set } = await supabase
    .from("client_sets")
    .select("id")
    .eq("drone_id", drone.id)
    .eq("variant_id", drone.variant_id)
    .eq("is_default", false)
    .maybeSingle();
  if (!set) {
    return NextResponse.json(
      { error: `${drone.serial} has no history of its own yet — assign it to a client first.` },
      { status: 409 }
    );
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.from("param_versions").select("version_label").eq("client_set_id", set.id);
  const next = Math.max(0, ...(existing ?? []).map((v) => parseInt(v.version_label, 10)).filter(Number.isFinite)) + 1;
  const label = String(next);
  const approved = caller.role === "admin";

  // Dedupe by name (last wins) and keep a downloadable .param file like uploads do.
  const unique = [...new Map(body.params.map((p) => [p.name, p.value])).entries()].map(([name, value]) => ({ name, value }));
  const storagePath = `${set.id}/${label}.param`;
  const { error: uploadError } = await admin.storage
    .from("param-files")
    .upload(storagePath, Buffer.from(writeParamFile(unique), "utf-8"), { contentType: "text/plain", upsert: true });
  if (uploadError) return NextResponse.json({ error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });

  if (approved) await admin.from("param_versions").update({ is_latest: false }).eq("client_set_id", set.id);

  const { data: version, error: versionError } = await admin
    .from("param_versions")
    .insert({
      client_set_id: set.id,
      version_label: label,
      storage_path: storagePath,
      changelog: body.changelog?.trim() || `Saved from ${drone.serial}`,
      created_by: caller.id,
      is_latest: approved,
      needs_review: !approved,
      firmware: body.firmware ?? null,
    })
    .select("id")
    .single();
  if (versionError || !version) {
    return NextResponse.json({ error: versionError?.message ?? "Could not create the version" }, { status: 500 });
  }

  for (let i = 0; i < unique.length; i += 500) {
    const { error } = await admin
      .from("param_values")
      .insert(unique.slice(i, i + 500).map((p) => ({ param_version_id: version.id, ...p })));
    if (error) {
      await admin.from("param_versions").delete().eq("id", version.id);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await supabase.from("drone_events").insert({
    drone_id: drone.id,
    param_version_id: version.id,
    chip_id: chipId,
    firmware: body.firmware ?? null,
    kind: "captured",
    diff_count: 0,
  });

  return NextResponse.json({ versionId: version.id, label, approved });
}
