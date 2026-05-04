import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

const ROLES = ["viewer", "contributor", "admin", "client"] as const;
type Role = (typeof ROLES)[number];

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

  const body = await request.json() as { role?: string; clientId?: string | null };
  const role = body.role as Role | undefined;
  const clientId = body.clientId ?? null;

  if (!role || !ROLES.includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  if (role === "client" && !clientId) return NextResponse.json({ error: "Client required for client role" }, { status: 400 });
  if (role !== "client" && clientId) return NextResponse.json({ error: "Client must be empty for non-client roles" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ role, client_id: clientId }).eq("id", id);
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
  if (user.id === id) return NextResponse.json({ error: "You cannot delete yourself" }, { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Deleting the auth user cascades to public.profiles via the FK.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
