import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";

interface CloneBody {
  variantId: string;
  clientSetId: string | null;
  newClientSet?: { clientName: string; serial: string; description?: string };
  createDefault?: boolean;
  versionLabel: string;
  changelog?: string;
}

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

  const { variantId, clientSetId, newClientSet, createDefault, versionLabel, changelog } = await request.json() as CloneBody;

  if (!variantId) return NextResponse.json({ error: "variantId required" }, { status: 400 });
  if (!versionLabel?.trim()) return NextResponse.json({ error: "versionLabel required" }, { status: 400 });
  if (!/^\d+$/.test(versionLabel.trim())) return NextResponse.json({ error: "Version label must be a whole number (e.g. 1)" }, { status: 400 });
  if (!clientSetId && !createDefault && (!newClientSet?.clientName?.trim() || !newClientSet?.serial?.trim())) {
    return NextResponse.json({ error: "clientSetId, createDefault, or newClientSet.clientName + serial required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Fetch the original version
  const { data: original, error: origError } = await admin
    .from("param_versions")
    .select("id, storage_path, client_set_id")
    .eq("id", id)
    .single();
  if (origError || !original) return NextResponse.json({ error: "Version not found" }, { status: 404 });

  // Resolve or create the target client set
  let targetClientSetId = clientSetId;
  if (!targetClientSetId) {
    if (createDefault) {
      // Check a Default doesn't already exist for this variant
      const { data: existingDefault } = await admin
        .from("client_sets")
        .select("id")
        .eq("variant_id", variantId)
        .eq("is_default", true)
        .maybeSingle();
      if (existingDefault) {
        return NextResponse.json({ error: "A Default param set already exists for this variant" }, { status: 409 });
      }
    }
    const { data: created, error: createError } = await admin
      .from("client_sets")
      .insert({
        client_name: createDefault ? "Default" : newClientSet!.clientName.trim(),
        serial: createDefault ? "" : newClientSet!.serial.trim(),
        description: createDefault ? null : (newClientSet!.description?.trim() || null),
        variant_id: variantId,
        is_default: createDefault ?? false,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (createError || !created) {
      const msg = createError?.code === "23505"
        ? "This client + serial already exists for this variant"
        : (createError?.message ?? "Client set creation failed");
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    targetClientSetId = created.id;
  }

  // Download + re-upload the file
  const { data: fileData } = await admin.storage.from("param-files").download(original.storage_path);
  if (!fileData) return NextResponse.json({ error: "Could not download source file" }, { status: 500 });

  const newPath = `${targetClientSetId}/${versionLabel.trim()}.param`;
  const { error: uploadError } = await admin.storage.from("param-files").upload(newPath, fileData);
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  // Mark all existing versions for this client_set as not latest
  await admin.from("param_versions").update({ is_latest: false }).eq("client_set_id", targetClientSetId!);

  // Insert new version row
  const { data: newVersion, error: versionError } = await admin
    .from("param_versions")
    .insert({
      client_set_id: targetClientSetId,
      version_label: versionLabel.trim(),
      storage_path: newPath,
      changelog: changelog?.trim() || null,
      created_by: user.id,
      is_latest: true,
    })
    .select("id")
    .single();
  if (versionError || !newVersion) return NextResponse.json({ error: versionError?.message ?? "Version insert failed" }, { status: 500 });

  // Copy param_values — read and write in chunks well below the PostgREST 1000-row cap.
  const PAGE_SIZE = 500;
  const allParamValues: { name: string; value: string }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: page } = await admin
      .from("param_values")
      .select("name, value")
      .eq("param_version_id", id)
      .range(from, from + PAGE_SIZE - 1);
    if (!page || page.length === 0) break;
    allParamValues.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  if (allParamValues.length) {
    // Deduplicate by name (last-write wins) then update SCR_USER2 to the
    // new version label. Deduplication is essential — source versions may
    // have duplicate name rows from old uploads, which would cause a unique
    // constraint violation and silently drop the entire insert.
    const newVersionInt = parseInt(versionLabel.trim(), 10);
    const paramMap = new Map<string, string>();
    for (const pv of allParamValues) paramMap.set(pv.name, pv.value);
    if (Number.isFinite(newVersionInt)) paramMap.set("SCR_USER2", String(newVersionInt));

    const rows = Array.from(paramMap.entries()).map(([name, value]) => ({
      param_version_id: newVersion.id,
      name,
      value,
    }));
    for (let i = 0; i < rows.length; i += PAGE_SIZE) {
      const { error: insertError } = await admin.from("param_values").insert(rows.slice(i, i + PAGE_SIZE));
      if (insertError) return NextResponse.json({ error: `Clone succeeded but param copy failed: ${insertError.message}` }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, versionId: newVersion.id, clientSetId: targetClientSetId });
}
