import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabase, createSessionClient, createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await createSupabase()
    .from("clients")
    .select("id, name")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: data ?? [] });
}

export async function POST(request: NextRequest) {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["contributor", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name } = await request.json() as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("clients")
    .insert({ name: name.trim(), created_by: user.id })
    .select("id, name")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "A client with that name already exists" : error.message;
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  return NextResponse.json(data, { status: 201 });
}
