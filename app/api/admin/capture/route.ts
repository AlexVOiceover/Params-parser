import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireContributor } from "@/lib/supabase/auth";

export async function POST(request: NextRequest) {
  const caller = await requireContributor();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const user = { id: caller.id };

  const body = await request.json() as {
    clientSetId: string;
    versionLabel: string;
    params: { name: string; value: string }[];
    /** If true, mark existing versions in the client_set as not-latest and the
     *  new version as latest. Default false (used by the "capture-for-review"
     *  flow that does not promote the capture above the curated version). */
    isLatest?: boolean;
  };

  if (!body.clientSetId || !body.versionLabel || !Array.isArray(body.params)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();

  // The client_set id comes from the request, so confirm it exists before
  // writing through the service-role client — otherwise any contributor could
  // inject a version into any client's drone.
  const { data: targetSet } = await admin
    .from("client_sets")
    .select("id")
    .eq("id", body.clientSetId)
    .maybeSingle();
  if (!targetSet) {
    return NextResponse.json({ error: "Unknown param set" }, { status: 404 });
  }

  // Demote previous latest in this client_set so the new one becomes latest.
  if (body.isLatest) {
    await admin
      .from("param_versions")
      .update({ is_latest: false })
      .eq("client_set_id", body.clientSetId);
  }

  const { data: version, error: versionError } = await admin
    .from("param_versions")
    .insert({
      client_set_id: body.clientSetId,
      version_label: body.versionLabel,
      storage_path: "",
      needs_review: true,
      is_latest: body.isLatest === true,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (versionError || !version) {
    return NextResponse.json({ error: versionError?.message ?? "Insert failed" }, { status: 500 });
  }

  // Enforce SCR_ENABLE=1 — required for versioning to work
  const paramMap = new Map(body.params.map((p) => [p.name, p.value]));
  paramMap.set("SCR_ENABLE", "1");
  const allParams = Array.from(paramMap.entries()).map(([name, value]) => ({ name, value }));

  const CHUNK = 500;
  for (let i = 0; i < allParams.length; i += CHUNK) {
    const chunk = allParams.slice(i, i + CHUNK).map(({ name, value }) => ({
      param_version_id: version.id,
      name,
      value,
    }));
    const { error: pvError } = await admin.from("param_values").insert(chunk);
    if (pvError) {
      await admin.from("param_versions").delete().eq("id", version.id);
      return NextResponse.json({ error: pvError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ versionId: version.id });
}
