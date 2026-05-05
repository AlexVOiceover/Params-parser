import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const familyId = request.nextUrl.searchParams.get("familyId");
  if (!familyId) return NextResponse.json({ error: "familyId required" }, { status: 400 });

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("variants")
    .select("id, name")
    .eq("family_id", familyId)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ variants: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { familyId, name, description } = await request.json() as { familyId: string; name: string; description?: string };
  if (!familyId) return NextResponse.json({ error: "familyId required" }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("variants")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      family_id: familyId,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-seed a Default client_set under this variant. Non-fatal on failure —
  // the user can add one manually later.
  const warnings: string[] = [];
  const { error: defaultErr } = await admin
    .from("client_sets")
    .insert({
      client_name: "Default",
      serial: "",
      variant_id: data.id,
      is_default: true,
      client_id: null,
      drone_id: null,
      created_by: user.id,
    });
  if (defaultErr) {
    warnings.push(`Variant created, but auto-create Default failed: ${defaultErr.message}`);
  }

  return NextResponse.json({ ok: true, id: data.id, warnings: warnings.length ? warnings : undefined });
}
