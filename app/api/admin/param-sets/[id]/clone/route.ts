import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { droneTypeId, name, description } = await request.json() as { droneTypeId: string; name: string; description?: string };
  if (!droneTypeId) return NextResponse.json({ error: "droneTypeId required" }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const admin = createAdminClient();

  // Fetch original param set
  const { data: original, error: origError } = await admin
    .from("param_sets")
    .select("id, name, description, drone_type_id, firmware_id")
    .eq("id", id)
    .single();
  if (origError || !original) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch all versions of the original
  const { data: versions } = await admin
    .from("param_versions")
    .select("id, version_label, storage_path, changelog")
    .eq("param_set_id", id)
    .order("created_at", { ascending: true });

  // Create new param set — preserve firmware only when cloning within same drone type
  const { data: newSet, error: setError } = await admin
    .from("param_sets")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      drone_type_id: droneTypeId,
      firmware_id: droneTypeId === original.drone_type_id ? original.firmware_id : null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (setError || !newSet) return NextResponse.json({ error: setError?.message ?? "Insert failed" }, { status: 500 });

  // Copy each version's file and rows
  for (const v of versions ?? []) {
    const { data: fileData } = await admin.storage.from("param-files").download(v.storage_path);
    if (!fileData) continue;

    const newPath = `${newSet.id}/${v.version_label}.param`;
    await admin.storage.from("param-files").upload(newPath, fileData);

    const { data: newVersion } = await admin
      .from("param_versions")
      .insert({
        param_set_id: newSet.id,
        version_label: v.version_label,
        storage_path: newPath,
        changelog: v.changelog,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (!newVersion) continue;

    const { data: paramValues } = await admin
      .from("param_values")
      .select("name, value")
      .eq("param_version_id", v.id);

    if (paramValues?.length) {
      await admin.from("param_values").insert(
        paramValues.map((pv) => ({ param_version_id: newVersion.id, name: pv.name, value: pv.value }))
      );
    }
  }

  return NextResponse.json({ ok: true, paramSetId: newSet.id });
}
