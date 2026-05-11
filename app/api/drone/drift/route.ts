import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { RUNTIME_PARAMS } from "@/lib/param-engine";

export const dynamic = "force-dynamic";

/**
 * POST /api/drone/drift
 * Body: { versionId: string, params: Record<string, string> }
 *
 * Compares the provided drone param values against the stored catalog
 * param_values for the given version. Returns { drift_count: number }.
 * Called only when versionStatus would be "up_to_date" to detect
 * post-flash modifications.
 */
export async function POST(request: NextRequest) {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ drift_count: null });

  const body = await request.json() as { versionId?: string; params?: Record<string, string> };
  if (!body.versionId || !body.params) return NextResponse.json({ drift_count: null });

  const catalogParams = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data: page } = await supabase
      .from("param_values")
      .select("name, value")
      .eq("param_version_id", body.versionId)
      .range(from, from + 999);
    if (!page || page.length === 0) break;
    for (const { name, value } of page) catalogParams.set(name, value);
    if (page.length < 1000) break;
  }

  let diff = 0;
  for (const [name, catalogVal] of catalogParams.entries()) {
    if (RUNTIME_PARAMS.has(name) || name === "SCR_USER1" || name === "SCR_USER2") continue;
    const droneVal = body.params[name];
    if (droneVal !== undefined && droneVal !== catalogVal) diff++;
  }

  return NextResponse.json({ drift_count: diff });
}
