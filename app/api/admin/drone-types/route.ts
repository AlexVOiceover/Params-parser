import { NextRequest, NextResponse } from "next/server";
import { createClient, createSessionClient, createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await createClient()
    .from("drone_types")
    .select("id, name")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ droneTypes: data ?? [] });
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/, "");
}

export async function POST(request: NextRequest) {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, description } = await request.json() as { name: string; description?: string };
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const slug = toSlug(name.trim());
  if (!slug) return NextResponse.json({ error: "Invalid name" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("drone_types")
    .insert({ slug, name: name.trim(), description: description ?? null })
    .select("id, slug, name, description")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "A drone type with that name already exists" : error.message;
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  return NextResponse.json(data, { status: 201 });
}
