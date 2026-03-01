import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import type { ProtectionList } from "@/lib/types";

export async function PUT(request: NextRequest) {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lists: ProtectionList[] = await request.json();
  const admin = createAdminClient();

  await admin.from("protection_lists").delete().is("owner_id", null);

  if (lists.length > 0) {
    await admin.from("protection_lists").insert(
      lists.map((l) => ({
        name: l.name,
        description: l.description || null,
        rules: l.rules,
        owner_id: null,
      }))
    );
  }

  return NextResponse.json({ ok: true });
}
