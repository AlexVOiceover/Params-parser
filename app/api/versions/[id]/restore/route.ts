import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { getCaller } from "@/lib/supabase/auth";
import { createVersion } from "@/lib/create-version";

export const dynamic = "force-dynamic";

/**
 * POST /api/versions/[id]/restore — body { changelog }.
 * Restoring never rewrites history: it saves a copy of the version as the next
 * one. An admin's restore becomes the target at once; anyone else's is a
 * proposal waiting for review. Clients may only restore on their own drone.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { id } = await params;
  const { changelog } = await request.json() as { changelog?: string };
  if (!changelog?.trim()) return NextResponse.json({ error: "Say why it is being restored" }, { status: 400 });

  // The caller's session decides whether they can see the version at all.
  const supabase = await createSessionClient();
  const { data: version } = await supabase
    .from("param_versions")
    .select("id, client_set_id, firmware, needs_review, client_sets!inner(is_default)")
    .eq("id", id)
    .maybeSingle();
  if (!version) return NextResponse.json({ error: "Version not found" }, { status: 404 });
  const set = version.client_sets as { is_default: boolean } | { is_default: boolean }[];
  const isDefault = Array.isArray(set) ? set[0]?.is_default : set.is_default;
  if (caller.role === "client" && isDefault) {
    return NextResponse.json({ error: "Only AIR6 can change a model template" }, { status: 403 });
  }
  if (version.needs_review) return NextResponse.json({ error: "Approve or delete a proposal instead of restoring it" }, { status: 400 });

  const values: { name: string; value: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("param_values")
      .select("name, value")
      .eq("param_version_id", id)
      .order("name")
      .range(from, from + 999);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    values.push(...data);
    if (data.length < 1000) break;
  }

  const approved = caller.role === "admin";
  const result = await createVersion(createAdminClient(), {
    setId: version.client_set_id,
    params: values,
    changelog: changelog.trim(),
    firmware: version.firmware,
    createdBy: caller.id,
    approved,
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ versionId: result.id, label: result.label, approved });
}
