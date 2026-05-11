import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const variantId = request.nextUrl.searchParams.get("variantId");
  if (!variantId) return NextResponse.json({ error: "variantId required" }, { status: 400 });

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["contributor", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_sets")
    .select("id, client_name, serial, is_default")
    .eq("variant_id", variantId)
    .order("client_name")
    .order("serial");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clientSets: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["contributor", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { variantId, clientId, droneId, clientName, serial, description, isDefault } = await request.json() as {
    variantId: string;
    clientId?: string;
    droneId?: string;
    clientName: string;
    serial: string;
    description?: string;
    isDefault?: boolean;
  };
  if (!variantId) return NextResponse.json({ error: "variantId required" }, { status: 400 });
  if (!clientName?.trim()) return NextResponse.json({ error: "Client name required" }, { status: 400 });
  // Serial is empty for Default rows; required for client rows.
  if (!isDefault && !serial?.trim()) return NextResponse.json({ error: "Serial required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_sets")
    .insert({
      client_name: clientName.trim(),
      serial: isDefault ? "" : serial.trim(),
      description: description?.trim() || null,
      variant_id: variantId,
      client_id: clientId ?? null,
      drone_id: droneId ?? null,
      is_default: isDefault ?? false,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "This client + serial already exists for this variant" : error.message;
    return NextResponse.json({ error: msg }, { status: 409 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
