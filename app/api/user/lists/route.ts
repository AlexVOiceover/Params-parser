import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import type { ProtectionList } from "@/lib/types";

export async function GET() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ lists: null });

  const { data } = await supabase
    .from("protection_lists")
    .select("name, description, rules")
    .eq("owner_id", user.id)
    .order("created_at");

  if (!data?.length) return NextResponse.json({ lists: null });

  const lists: ProtectionList[] = data.map((row) => ({
    name: row.name,
    description: row.description ?? "",
    rules: row.rules ?? [],
  }));

  return NextResponse.json({ lists });
}

export async function PUT(request: NextRequest) {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const lists: ProtectionList[] = await request.json();

  await supabase.from("protection_lists").delete().eq("owner_id", user.id);

  if (lists.length > 0) {
    await supabase.from("protection_lists").insert(
      lists.map((l) => ({
        name: l.name,
        description: l.description || null,
        rules: l.rules,
        owner_id: user.id,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
