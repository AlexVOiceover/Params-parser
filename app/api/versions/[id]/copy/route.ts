import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireContributor } from "@/lib/supabase/auth";
import { createVersion } from "@/lib/create-version";

export const dynamic = "force-dynamic";

/**
 * POST /api/versions/[id]/copy — body { droneId } or { variantId }, plus changelog.
 * Staff only. Saves a copy of a version as the next version of another drone's
 * history, or of a model's template (created on first use). The source is never
 * changed. An admin's copy is approved at once; anyone else's waits for review.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const caller = await requireContributor();
  if (!caller) return NextResponse.json({ error: "Only staff can copy versions" }, { status: 403 });
  const { id } = await params;
  const { droneId, variantId, changelog } = await request.json() as { droneId?: string; variantId?: string; changelog?: string };
  if (!changelog?.trim()) return NextResponse.json({ error: "Say why it is being copied" }, { status: 400 });
  if (!droneId === !variantId) return NextResponse.json({ error: "Choose one drone or one model" }, { status: 400 });

  const admin = createAdminClient();
  const { data: source } = await admin.from("param_versions").select("id, firmware").eq("id", id).maybeSingle();
  if (!source) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  let setId: string | null = null;
  if (droneId) {
    const { data: drone } = await admin.from("drones").select("id, serial, variant_id, client_id").eq("id", droneId).maybeSingle();
    if (!drone) return NextResponse.json({ error: "Drone not found" }, { status: 404 });
    const { data: set } = await admin.from("client_sets").select("id").eq("drone_id", drone.id).eq("is_default", false).maybeSingle();
    if (set) {
      setId = set.id;
    } else {
      const { data: client } = drone.client_id
        ? await admin.from("clients").select("name").eq("id", drone.client_id).maybeSingle()
        : { data: null };
      const { data: created, error } = await admin
        .from("client_sets")
        .insert({ client_name: client?.name ?? drone.serial, serial: drone.serial, variant_id: drone.variant_id, client_id: drone.client_id, drone_id: drone.id, created_by: caller.id })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      setId = created.id;
    }
  } else {
    const { data: set } = await admin.from("client_sets").select("id").eq("variant_id", variantId!).eq("is_default", true).maybeSingle();
    if (set) {
      setId = set.id;
    } else {
      const { data: created, error } = await admin
        .from("client_sets")
        .insert({ client_name: "Default", serial: "", variant_id: variantId!, is_default: true, created_by: caller.id })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      setId = created.id;
    }
  }

  const values: { name: string; value: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("param_values").select("name, value").eq("param_version_id", id).order("name").range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    values.push(...data);
    if (data.length < 1000) break;
  }

  if (!setId) return NextResponse.json({ error: "Could not find where to copy it" }, { status: 500 });
  const approved = caller.role === "admin";
  const result = await createVersion(admin, {
    setId,
    params: values,
    changelog: changelog.trim(),
    firmware: source.firmware,
    createdBy: caller.id,
    approved,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ versionId: result.id, label: result.label, approved });
}
