import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "contributor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json() as {
    clientSetId: string;
    versionLabel: string;
    params: { name: string; value: string }[];
  };

  if (!body.clientSetId || !body.versionLabel || !Array.isArray(body.params)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: version, error: versionError } = await admin
    .from("param_versions")
    .insert({
      client_set_id: body.clientSetId,
      version_label: body.versionLabel,
      storage_path: "",
      needs_review: true,
      is_latest: false,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (versionError || !version) {
    return NextResponse.json({ error: versionError?.message ?? "Insert failed" }, { status: 500 });
  }

  const CHUNK = 500;
  for (let i = 0; i < body.params.length; i += CHUNK) {
    const chunk = body.params.slice(i, i + CHUNK).map(({ name, value }) => ({
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
