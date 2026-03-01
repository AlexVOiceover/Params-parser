import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const droneTypeId = request.nextUrl.searchParams.get("droneTypeId");
  if (!droneTypeId) return NextResponse.json({ error: "droneTypeId required" }, { status: 400 });

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("param_sets")
    .select("id, name")
    .eq("drone_type_id", droneTypeId)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ paramSets: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { droneTypeId, name, description } = await request.json() as { droneTypeId: string; name: string; description?: string };
  if (!droneTypeId) return NextResponse.json({ error: "droneTypeId required" }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("param_sets")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      drone_type_id: droneTypeId,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
