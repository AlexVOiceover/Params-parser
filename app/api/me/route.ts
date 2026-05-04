import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ role: null, clientName: null });

    const { data } = await supabase
      .from("profiles")
      .select("role, client_id")
      .eq("id", user.id)
      .single();

    let clientName: string | null = null;
    if (data?.role === "client" && data.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("name")
        .eq("id", data.client_id)
        .single();
      clientName = client?.name ?? null;
    }

    return NextResponse.json({ role: data?.role ?? null, clientName });
  } catch {
    return NextResponse.json({ role: null, clientName: null });
  }
}
