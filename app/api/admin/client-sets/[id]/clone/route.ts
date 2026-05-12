import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { variantId, clientName, serial, description } = await request.json() as { variantId: string; clientName: string; serial: string; description?: string };
  if (!variantId) return NextResponse.json({ error: "variantId required" }, { status: 400 });
  if (!clientName?.trim()) return NextResponse.json({ error: "clientName required" }, { status: 400 });
  if (!serial?.trim()) return NextResponse.json({ error: "serial required" }, { status: 400 });

  const admin = createAdminClient();

  // Fetch the original client set
  const { data: original, error: origError } = await admin
    .from("client_sets")
    .select("id, client_name, serial, description, variant_id")
    .eq("id", id)
    .single();
  if (origError || !original) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch all versions of the original
  const { data: versions } = await admin
    .from("param_versions")
    .select("id, version_label, storage_path, changelog, is_latest")
    .eq("client_set_id", id)
    .order("created_at", { ascending: true });

  // Create the new client set
  const { data: newClientSet, error: csError } = await admin
    .from("client_sets")
    .insert({
      client_name: clientName.trim(),
      serial: serial.trim(),
      description: description?.trim() || null,
      variant_id: variantId,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (csError || !newClientSet) {
    const msg = csError?.code === "23505" ? "This client + serial already exists for this variant" : (csError?.message ?? "Insert failed");
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  // Copy each version's file and rows
  for (const v of versions ?? []) {
    const { data: fileData } = await admin.storage.from("param-files").download(v.storage_path);
    if (!fileData) continue;

    const newPath = `${newClientSet.id}/${v.version_label}.param`;
    await admin.storage.from("param-files").upload(newPath, fileData);

    const { data: newVersion } = await admin
      .from("param_versions")
      .insert({
        client_set_id: newClientSet.id,
        version_label: v.version_label,
        storage_path: newPath,
        changelog: v.changelog,
        created_by: user.id,
        is_latest: v.is_latest,
      })
      .select("id")
      .single();
    if (!newVersion) continue;

    const pvRows: { name: string; value: string }[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: page } = await admin
        .from("param_values")
        .select("name, value")
        .eq("param_version_id", v.id)
        .range(from, from + 999);
      if (!page || page.length === 0) break;
      pvRows.push(...page);
      if (page.length < 1000) break;
    }
    if (pvRows.length) {
      const rows = pvRows.map((pv) => ({ param_version_id: newVersion.id, name: pv.name, value: pv.value }));
      for (let i = 0; i < rows.length; i += 500) {
        await admin.from("param_values").insert(rows.slice(i, i + 500));
      }
    }
  }

  return NextResponse.json({ ok: true, clientSetId: newClientSet.id });
}
