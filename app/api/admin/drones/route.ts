import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/drones
 * Creates a drone row without requiring a client — used for orphan registration
 * where no client is assigned at bring-up time.
 *
 * Body: { serial: string, variantId: string, clientId?: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["contributor", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { serial, variantId, clientId } = await request.json() as {
    serial?: string;
    variantId?: string;
    clientId?: string | null;
  };

  if (!serial?.trim()) return NextResponse.json({ error: "Serial is required" }, { status: 400 });
  if (!variantId) return NextResponse.json({ error: "Variant is required" }, { status: 400 });

  const admin = createAdminClient();

  // Guard against duplicate serial for the same client (or globally if no client).
  const dupQuery = admin.from("drones").select("id").eq("serial", serial.trim());
  const { data: existing } = clientId
    ? await dupQuery.eq("client_id", clientId)
    : await dupQuery.is("client_id", null);

  if (existing && existing.length > 0) {
    const ctx = clientId ? "for this client" : "without a client";
    return NextResponse.json(
      { error: `A drone with serial "${serial.trim()}" already exists ${ctx}` },
      { status: 409 }
    );
  }

  const { data, error } = await admin
    .from("drones")
    .insert({
      serial: serial.trim(),
      variant_id: variantId,
      client_id: clientId ?? null,
      created_by: user.id,
    })
    .select("id, serial, variant_id, client_id")
    .single();

  if (error) {
    const msg = error.code === "23505"
      ? `A drone with serial "${serial.trim()}" already exists`
      : error.message;
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  return NextResponse.json({ ok: true, id: data.id, drone: data }, { status: 201 });
}
