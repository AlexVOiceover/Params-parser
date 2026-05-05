import { NextRequest, NextResponse } from "next/server";
import { createClient, createSessionClient, createAdminClient } from "@/lib/supabase/server";

export async function GET() {
  const { data, error } = await createClient()
    .from("families")
    .select("id, name")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ families: data ?? [] });
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
    .from("families")
    .insert({ slug, name: name.trim(), description: description ?? null })
    .select("id, slug, name, description")
    .single();

  if (error) {
    const msg = error.code === "23505" ? "A family with that name already exists" : error.message;
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  // Auto-seed: every new family ships with a "Base" variant and that variant
  // ships with a "Default" client_set. Failures here are non-fatal — the
  // family stays, the user can manually add a Base/Default if they need to.
  const warnings: string[] = [];
  const { data: variant, error: variantErr } = await admin
    .from("variants")
    .insert({ name: "Base", family_id: data.id, created_by: user.id })
    .select("id")
    .single();
  if (variantErr) {
    warnings.push(`Family created, but auto-create Base variant failed: ${variantErr.message}`);
  } else {
    const { error: defaultErr } = await admin
      .from("client_sets")
      .insert({
        client_name: "Default",
        serial: "",
        variant_id: variant.id,
        is_default: true,
        client_id: null,
        drone_id: null,
        created_by: user.id,
      });
    if (defaultErr) {
      warnings.push(`Base variant created, but auto-create Default failed: ${defaultErr.message}`);
    }
  }

  return NextResponse.json({ ...data, warnings: warnings.length ? warnings : undefined }, { status: 201 });
}
