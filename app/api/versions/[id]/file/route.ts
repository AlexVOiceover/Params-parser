import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { writeParamFile } from "@/lib/param-engine";
import { isUnmanaged } from "@/lib/desired-state";

export const dynamic = "force-dynamic";

/**
 * GET /api/versions/[id]/file[?shareable=1] — the version as a .param file,
 * built from its stored params. RLS on the caller's session decides whether
 * they may see it. Shareable leaves out every per-drone param (calibration,
 * tuning, radio, IDs), so it can be loaded onto another airframe.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data: version } = await supabase
    .from("param_versions")
    .select("id, version_label")
    .eq("id", id)
    .maybeSingle();
  if (!version) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows: { name: string; value: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("param_values")
      .select("name, value")
      .eq("param_version_id", id)
      .order("name")
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }

  const shareable = request.nextUrl.searchParams.get("shareable") === "1";
  const kept = shareable ? rows.filter((r) => !isUnmanaged(r.name)) : rows;
  const body = shareable
    ? `# v${version.version_label} without per-drone params (${rows.length - kept.length} left out: calibration, tuning, radio, IDs)\n${writeParamFile(kept)}`
    : writeParamFile(kept);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="v${version.version_label}${shareable ? "-shareable" : ""}.param"`,
      "Cache-Control": "private, no-store",
    },
  });
}
