import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { parseParamFile } from "@/lib/param-engine";

export async function POST(request: NextRequest) {
  // 1. Verify session
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 2. Verify role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["contributor", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Parse form data
  const formData = await request.formData();
  const droneTypeId = formData.get("droneTypeId") as string;
  const paramSetId = formData.get("paramSetId") as string;
  const versionLabel = formData.get("versionLabel") as string;
  const changelog = (formData.get("changelog") as string | null) || null;
  const file = formData.get("file") as File | null;

  if (!file || !versionLabel || !droneTypeId || !paramSetId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!/^\d+\.\d+$/.test(versionLabel.trim())) {
    return NextResponse.json({ error: "Version must be in format number.number (e.g. 1.0)" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 4. Upload file to storage
  const storagePath = `${paramSetId}/${versionLabel}.param`;
  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from("param-files")
    .upload(storagePath, fileBuffer, { contentType: "text/plain", upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // 5. Mark previous versions as not latest
  await admin.from("param_versions").update({ is_latest: false }).eq("param_set_id", paramSetId);

  // 6. Insert new version
  const { data: pv, error: pvError } = await admin.from("param_versions").insert({
    param_set_id: paramSetId,
    version_label: versionLabel,
    storage_path: storagePath,
    changelog,
    created_by: user.id,
    is_latest: true,
  }).select("id").single();

  if (pvError || !pv) {
    return NextResponse.json({ error: pvError?.message ?? "Failed to create version" }, { status: 500 });
  }

  // 7. Parse and store individual param values for analytics
  const fileText = Buffer.from(fileBuffer).toString("utf-8");
  const paramValues = parseParamFile(fileText).map(({ name, value }) => ({
    param_version_id: pv.id,
    name,
    value,
  }));

  if (paramValues.length > 0) {
    await admin.from("param_values").insert(paramValues);
  }

  return NextResponse.json({ ok: true, paramSetId });
}
