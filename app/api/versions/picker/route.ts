import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getPickerHistories } from "@/lib/version-picker";

export const dynamic = "force-dynamic";

/**
 * GET /api/versions/picker — every history the caller may see, with its
 * versions, for choosing what to compare. RLS on the session decides the scope.
 */
export async function GET(): Promise<NextResponse> {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.json({ histories: await getPickerHistories(supabase) });
}
