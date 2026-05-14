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

  const { familyId, name, description } = await request.json() as { familyId: string; name: string; description?: string };
  if (!familyId) return NextResponse.json({ error: "familyId required" }, { status: 400 });
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const admin = createAdminClient();

  // Fetch original variant
  const { data: original, error: origError } = await admin
    .from("variants")
    .select("id, name, description, family_id")
    .eq("id", id)
    .single();
  if (origError || !original) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Fetch all client sets of the original variant
  const { data: clientSets } = await admin
    .from("client_sets")
    .select("id, client_name, serial, description")
    .eq("variant_id", id)
    .order("created_at", { ascending: true });

  // Create new variant
  const { data: newVariant, error: variantError } = await admin
    .from("variants")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      family_id: familyId,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (variantError || !newVariant) return NextResponse.json({ error: variantError?.message ?? "Insert failed" }, { status: 500 });

  // Copy each client set + its versions
  for (const cs of clientSets ?? []) {
    const { data: newCs, error: csError } = await admin
      .from("client_sets")
      .insert({
        client_name: cs.client_name,
        serial: cs.serial,
        description: cs.description,
        variant_id: newVariant.id,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (csError || !newCs) continue;

    const { data: versions } = await admin
      .from("param_versions")
      .select("id, version_label, storage_path, changelog, is_latest")
      .eq("client_set_id", cs.id)
      .order("created_at", { ascending: true });

    for (const v of versions ?? []) {
      const { data: fileData } = await admin.storage.from("param-files").download(v.storage_path);
      if (!fileData) continue;

      const newPath = `${newCs.id}/${v.version_label}.param`;
      await admin.storage.from("param-files").upload(newPath, fileData);

      const { data: newVersion } = await admin
        .from("param_versions")
        .insert({
          client_set_id: newCs.id,
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
          .order("name")
          .range(from, from + 999);
        if (!page || page.length === 0) break;
        pvRows.push(...page);
        if (page.length < 1000) break;
      }
      if (pvRows.length) {
        const pvMap = new Map(pvRows.map((pv) => [pv.name, pv.value]));
        pvMap.set("SCR_ENABLE", "1");
        const rows = Array.from(pvMap.entries()).map(([name, value]) => ({ param_version_id: newVersion.id, name, value }));
        for (let i = 0; i < rows.length; i += 500) {
          await admin.from("param_values").insert(rows.slice(i, i + 500));
        }
      }
    }
  }

  return NextResponse.json({ ok: true, variantId: newVariant.id });
}
