import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireContributor } from "@/lib/supabase/auth";
import { parseParamFile } from "@/lib/param-engine";
import { createVersion } from "@/lib/create-version";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload — multipart: file, changelog, firmware?, and either
 * clientSetId (a drone's history) or variantId (that model's template,
 * created on first use). Staff only. The server assigns the version number;
 * an admin's upload is approved at once, anyone else's waits for review.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const caller = await requireContributor();
  if (!caller) return NextResponse.json({ error: "Only staff can upload versions" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  const changelog = String(form.get("changelog") ?? "").trim();
  const firmware = String(form.get("firmware") ?? "").trim() || null;
  const clientSetId = form.get("clientSetId");
  const variantId = form.get("variantId");

  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a .param file" }, { status: 400 });
  if (!changelog) return NextResponse.json({ error: "Say what this version changes" }, { status: 400 });
  if (firmware && !/^\d+\.\d+\.\d+$/.test(firmware)) {
    return NextResponse.json({ error: "Firmware must look like 4.5.7" }, { status: 400 });
  }
  const params = parseParamFile(await file.text());
  if (params.length === 0) return NextResponse.json({ error: "No params found in that file" }, { status: 400 });

  const admin = createAdminClient();
  let setId: string | null = null;
  if (typeof clientSetId === "string" && clientSetId) {
    const { data } = await admin.from("client_sets").select("id").eq("id", clientSetId).maybeSingle();
    setId = data?.id ?? null;
  } else if (typeof variantId === "string" && variantId) {
    const { data: existing } = await admin
      .from("client_sets")
      .select("id")
      .eq("variant_id", variantId)
      .eq("is_default", true)
      .maybeSingle();
    if (existing) {
      setId = existing.id;
    } else {
      const { data: created, error } = await admin
        .from("client_sets")
        .insert({ client_name: "Default", serial: "", variant_id: variantId, is_default: true, created_by: caller.id })
        .select("id")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      setId = created.id;
    }
  }
  if (!setId) return NextResponse.json({ error: "Unknown drone or model" }, { status: 404 });

  const result = await createVersion(admin, {
    setId,
    params: params.map((p) => ({ name: p.name, value: p.value })),
    changelog,
    firmware,
    createdBy: caller.id,
    approved: caller.role === "admin",
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ versionId: result.id, label: result.label, approved: caller.role === "admin" });
}
