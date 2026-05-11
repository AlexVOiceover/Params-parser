import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ count: 0 });

  const { count } = await supabase
    .from("param_versions")
    .select("id", { count: "exact", head: true })
    .eq("needs_review", true);

  return NextResponse.json({ count: count ?? 0 });
}
