import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { requireContributor } from "@/lib/supabase/auth";
import { createVersion } from "@/lib/create-version";
import { latestApproved } from "@/lib/versions";

/**
 * POST /api/admin/drones
 * Body: { serial, variantId, clientId?, fromTemplate? }
 *
 * Staff only. Adds a drone with its own history in one step. With
 * fromTemplate, v1 is a copy of the model template's latest version — minus
 * nothing: per-drone params are simply never installed.
 */
export async function POST(request: NextRequest) {
  const caller = await requireContributor();
  if (!caller) return NextResponse.json({ error: "Only staff can add drones" }, { status: 403 });

  const { serial: rawSerial, variantId, clientId, fromTemplate } = await request.json() as {
    serial?: string;
    variantId?: string;
    clientId?: string | null;
    fromTemplate?: boolean;
  };
  const serial = rawSerial?.trim() ?? "";
  if (!serial) return NextResponse.json({ error: "Serial is required" }, { status: 400 });
  if (!variantId) return NextResponse.json({ error: "Model is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from("drones").select("id").eq("serial", serial).maybeSingle();
  if (existing) return NextResponse.json({ error: `A drone with serial "${serial}" already exists` }, { status: 409 });

  const { data: client } = clientId
    ? await admin.from("clients").select("name").eq("id", clientId).maybeSingle()
    : { data: null };
  if (clientId && !client) return NextResponse.json({ error: "Unknown client" }, { status: 400 });

  const { data: drone, error } = await admin
    .from("drones")
    .insert({ serial, variant_id: variantId, client_id: clientId ?? null, created_by: caller.id })
    .select("id, serial, variant_id, client_id")
    .single();
  if (error || !drone) {
    return NextResponse.json({ error: error?.code === "23505" ? `A drone with serial "${serial}" already exists` : error?.message }, { status: 409 });
  }

  const { data: set, error: setError } = await admin
    .from("client_sets")
    .insert({
      client_name: client?.name ?? serial,
      serial,
      variant_id: variantId,
      client_id: clientId ?? null,
      drone_id: drone.id,
      created_by: caller.id,
    })
    .select("id")
    .single();
  if (setError || !set) {
    await admin.from("drones").delete().eq("id", drone.id);
    return NextResponse.json({ error: setError?.message ?? "Could not create the drone's history" }, { status: 500 });
  }

  let firstVersion: string | null = null;
  if (fromTemplate) {
    const { data: template } = await admin
      .from("client_sets")
      .select("id, param_versions(id, version_label, needs_review, firmware)")
      .eq("variant_id", variantId)
      .eq("is_default", true)
      .maybeSingle();
    const source = latestApproved((template?.param_versions ?? []) as { id: string; version_label: string; needs_review: boolean; firmware: string | null }[]);
    if (source) {
      const values: { name: string; value: string }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await admin.from("param_values").select("name, value").eq("param_version_id", source.id).order("name").range(from, from + 999);
        if (!data || data.length === 0) break;
        values.push(...data);
        if (data.length < 1000) break;
      }
      const created = await createVersion(admin, {
        setId: set.id,
        params: values,
        changelog: `Started from the model template v${source.version_label}`,
        firmware: source.firmware,
        createdBy: caller.id,
        approved: caller.role === "admin",
      });
      if (!("error" in created)) firstVersion = created.label;
    }
  }

  return NextResponse.json({ ok: true, id: drone.id, drone, clientSetId: set.id, firstVersion }, { status: 201 });
}
