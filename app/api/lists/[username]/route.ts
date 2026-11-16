import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PROTECTION_LISTS } from "@/lib/param-engine";
import type { ProtectionList } from "@/lib/types";

export async function GET() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("protection_lists")
      .select("name, description, rules")
      .is("owner_id", null)
      .order("created_at");

    if (error || !data?.length) {
      return NextResponse.json({ lists: DEFAULT_PROTECTION_LISTS, source: "defaults" });
    }

    const lists: ProtectionList[] = data.map((row) => ({
      name: row.name,
      description: row.description ?? "",
      rules: row.rules ?? [],
    }));

    return NextResponse.json({ lists, source: "supabase" });
  } catch (err) {
    console.error("[lists/GET] Supabase error:", err);
    return NextResponse.json({ lists: DEFAULT_PROTECTION_LISTS, source: "error", error: String(err) });
  }
}

// User-specific list persistence requires authentication (Phase 3).
export async function PUT() {
  return NextResponse.json({ ok: true });
}
