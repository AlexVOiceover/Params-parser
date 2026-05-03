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

  const { serial } = await request.json() as { serial?: string };
  if (!serial?.trim()) return NextResponse.json({ error: "Serial cannot be empty" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from("drones").update({ serial: serial.trim() }).eq("id", id);
  if (error) {
    const msg = error.code === "23505" ? "A drone with that serial already exists for this client" : error.message;
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

  // Block deletion if any client_set references this drone.
  const { count } = await admin
    .from("client_sets")
    .select("id", { count: "exact", head: true })
    .eq("drone_id", id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${count} client set${count === 1 ? "" : "s"} reference this drone` },
      { status: 409 }
    );
  }

  const { error } = await admin.from("drones").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
