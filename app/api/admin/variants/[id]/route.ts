import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();

  // Get storage paths for every version under every client set of this variant,
  // so we can clean up the bucket after the cascade delete.
  const { data: clientSets } = await admin
    .from("client_sets")
    .select("id")
    .eq("variant_id", id);

  const clientSetIds = (clientSets ?? []).map((cs) => cs.id);
  let storagePaths: string[] = [];
  if (clientSetIds.length > 0) {
    const { data: versions } = await admin
      .from("param_versions")
      .select("storage_path")
      .in("client_set_id", clientSetIds);
    storagePaths = (versions ?? []).map((v) => v.storage_path);
  }

  const { error } = await admin.from("variants").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort storage cleanup (cascade already removed DB rows)
  if (storagePaths.length) {
    await admin.storage.from("param-files").remove(storagePaths);
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json() as { name?: string; description?: string };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.name !== undefined) {
    if (!body.name.trim()) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    update.name = body.name.trim();
  }
  if (body.description !== undefined) update.description = body.description.trim() || null;

  const admin = createAdminClient();
  const { error } = await admin.from("variants").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
