import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { writeParamFile } from "@/lib/param-engine";

/**
 * PATCH /api/admin/param-versions/[id]/values
 * Body: { edits: Record<string, number> }  — param name → new value
 *
 * Updates param_values rows for the given version, regenerates the .param
 * file in storage, and returns the updated version.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["admin", "contributor"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as { edits: Record<string, number> };
  if (!body.edits || typeof body.edits !== "object") {
    return NextResponse.json({ error: "edits object required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch the version to get storage_path and client_set_id
  const { data: version } = await admin
    .from("param_versions")
    .select("id, storage_path, client_set_id, version_label")
    .eq("id", id)
    .single();
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  // Apply edits — param_values has a composite PK (param_version_id, name),
  // no surrogate id column. Use upsert so existing rows are updated and
  // missing ones are created.
  const upsertRows = Object.entries(body.edits).map(([name, value]) => ({
    param_version_id: id,
    name,
    value: String(value),
  }));
  const { error: upsertError } = await admin
    .from("param_values")
    .upsert(upsertRows, { onConflict: "param_version_id,name" });
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // Re-fetch all param_values and regenerate the stored .param file
  const { data: allValues } = await admin
    .from("param_values")
    .select("name, value")
    .eq("param_version_id", id);

  if (allValues && version.storage_path) {
    const content = writeParamFile(allValues);
    await admin.storage
      .from("param-files")
      .upload(version.storage_path, Buffer.from(content, "utf-8"), {
        contentType: "text/plain",
        upsert: true,
      });
  }

  return NextResponse.json({ ok: true });
}
