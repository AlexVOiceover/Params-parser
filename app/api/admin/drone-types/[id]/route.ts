import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

async function requireAdmin(supabase: Awaited<ReturnType<typeof createSessionClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return profile?.role === "admin" ? user : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSessionClient();
  if (!await requireAdmin(supabase)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const update: Record<string, string | null> = {};
  if (typeof body.name === "string") update.name = body.name.trim();
  if ("description" in body) update.description = body.description?.trim() || null;

  const admin = createAdminClient();
  const { error } = await admin.from("drone_types").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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

  // Block deletion if any param sets reference this drone type
  const { count } = await admin
    .from("param_sets")
    .select("id", { count: "exact", head: true })
    .eq("drone_type_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${count} param set${count === 1 ? "" : "s"} exist for this drone type` },
      { status: 409 }
    );
  }

  const { error } = await admin.from("drone_types").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
