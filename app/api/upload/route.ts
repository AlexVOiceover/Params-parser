import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

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
  const mode = formData.get("mode") as string;
  const droneTypeId = formData.get("droneTypeId") as string;
  const firmwareId = (formData.get("firmwareId") as string | null) || null;
  const versionLabel = formData.get("versionLabel") as string;
  const changelog = (formData.get("changelog") as string | null) || null;
  const file = formData.get("file") as File | null;

  if (!file || !versionLabel || !droneTypeId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  let paramSetId: string;

  if (mode === "new") {
    const name = formData.get("name") as string | null;
    if (!name) return NextResponse.json({ error: "Name is required for a new param set" }, { status: 400 });
    const description = (formData.get("description") as string | null) || null;

    const { data: ps, error: psError } = await admin
      .from("param_sets")
      .insert({
        name,
        description,
        drone_type_id: droneTypeId,
        firmware_id: firmwareId,
        created_by: user.id,
        published: false,
      })
      .select("id")
      .single();

    if (psError || !ps) {
      return NextResponse.json({ error: psError?.message ?? "Failed to create param set" }, { status: 500 });
    }
    paramSetId = ps.id;
  } else {
    const existing = formData.get("paramSetId") as string | null;
    if (!existing) return NextResponse.json({ error: "Param set ID required" }, { status: 400 });
    paramSetId = existing;
  }

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
  const { error: pvError } = await admin.from("param_versions").insert({
    param_set_id: paramSetId,
    version_label: versionLabel,
    storage_path: storagePath,
    changelog,
    created_by: user.id,
    is_latest: true,
  });

  if (pvError) {
    return NextResponse.json({ error: pvError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, paramSetId });
}
