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

  // Get storage paths before deleting so we can clean up the bucket
  const { data: versions } = await admin
    .from("param_versions")
    .select("storage_path")
    .eq("param_set_id", id);

  const { error } = await admin.from("param_sets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Best-effort storage cleanup (cascade already removed DB rows)
  if (versions?.length) {
    await admin.storage.from("param-files").remove(versions.map((v) => v.storage_path));
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
  const { error } = await admin.from("param_sets").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
