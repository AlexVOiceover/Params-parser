import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["contributor", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as { clientName?: string; serial?: string; description?: string };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.clientName !== undefined) {
    if (!body.clientName.trim()) return NextResponse.json({ error: "Client name cannot be empty" }, { status: 400 });
    update.client_name = body.clientName.trim();
  }
  if (body.serial !== undefined) {
    if (!body.serial.trim()) return NextResponse.json({ error: "Serial cannot be empty" }, { status: 400 });
    update.serial = body.serial.trim();
  }
  if (body.description !== undefined) update.description = body.description.trim() || null;

  const admin = createAdminClient();
  const { error } = await admin.from("client_sets").update(update).eq("id", id);
  if (error) {
    const msg = error.code === "23505" ? "This client + serial already exists for this variant" : error.message;
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}

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

  // Get storage paths before deleting so we can clean up the bucket.
  const { data: versions } = await admin
    .from("param_versions")
    .select("storage_path")
    .eq("client_set_id", id);

  const { error } = await admin.from("client_sets").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (versions?.length) {
    await admin.storage.from("param-files").remove(versions.map((v) => v.storage_path));
  }

  return NextResponse.json({ ok: true });
}
