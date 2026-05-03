import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase, createSessionClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await createSupabase()
    .from("drones")
    .select("id, serial, variant_id")
    .eq("client_id", id)
    .order("serial");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drones: data ?? [] });
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
  if (!profile || !["contributor", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { serial, variantId } = await request.json() as { serial?: string; variantId?: string };
  if (!serial?.trim()) return NextResponse.json({ error: "Serial is required" }, { status: 400 });
  if (!variantId) return NextResponse.json({ error: "Variant is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("drones")
    .insert({ client_id: id, variant_id: variantId, serial: serial.trim(), created_by: user.id })
    .select("id, serial, variant_id")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "A drone with that serial already exists for this client" : error.message;
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  return NextResponse.json(data, { status: 201 });
}
