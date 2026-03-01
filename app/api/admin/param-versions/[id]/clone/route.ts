import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

interface CloneBody {
  droneTypeId: string;
  paramSetId: string | null;
  newParamSet?: { name: string; description?: string };
  versionLabel: string;
  changelog?: string;
}

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

  const { droneTypeId, paramSetId, newParamSet, versionLabel, changelog } = await request.json() as CloneBody;

  if (!droneTypeId) return NextResponse.json({ error: "droneTypeId required" }, { status: 400 });
  if (!versionLabel?.trim()) return NextResponse.json({ error: "versionLabel required" }, { status: 400 });
  if (!paramSetId && !newParamSet?.name?.trim()) return NextResponse.json({ error: "paramSetId or newParamSet.name required" }, { status: 400 });

  const admin = createAdminClient();

  // Fetch the original version
  const { data: original, error: origError } = await admin
    .from("param_versions")
    .select("id, storage_path, param_set_id")
    .eq("id", id)
    .single();
  if (origError || !original) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  // Resolve or create the target param set
  let targetParamSetId = paramSetId;
  if (!targetParamSetId) {
    const { data: created, error: createError } = await admin
      .from("param_sets")
      .insert({
        name: newParamSet!.name.trim(),
        description: newParamSet!.description?.trim() || null,
        drone_type_id: droneTypeId,
        firmware_id: null,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (createError || !created) return NextResponse.json({ error: createError?.message ?? "Param set creation failed" }, { status: 500 });
    targetParamSetId = created.id;
  }

  // Download + re-upload the file
  const { data: fileData } = await admin.storage.from("param-files").download(original.storage_path);
  if (!fileData) return NextResponse.json({ error: "Could not download source file" }, { status: 500 });

  const newPath = `${targetParamSetId}/${versionLabel.trim()}.param`;
  const { error: uploadError } = await admin.storage.from("param-files").upload(newPath, fileData);
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  // Insert new version row
  const { data: newVersion, error: versionError } = await admin
    .from("param_versions")
    .insert({
      param_set_id: targetParamSetId,
      version_label: versionLabel.trim(),
      storage_path: newPath,
      changelog: changelog?.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (versionError || !newVersion) return NextResponse.json({ error: versionError?.message ?? "Version insert failed" }, { status: 500 });

  // Copy param_values
  const { data: paramValues } = await admin
    .from("param_values")
    .select("name, value")
    .eq("param_version_id", id);

  if (paramValues?.length) {
    await admin.from("param_values").insert(
      paramValues.map((pv) => ({ param_version_id: newVersion.id, name: pv.name, value: pv.value }))
    );
  }

  return NextResponse.json({ ok: true, versionId: newVersion.id, paramSetId: targetParamSetId });
}
