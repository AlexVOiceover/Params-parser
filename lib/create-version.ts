import type { createAdminClient } from "@/lib/supabase/server";
import { writeParamFile } from "@/lib/param-engine";
import { nextLabel } from "@/lib/versions";

type Admin = ReturnType<typeof createAdminClient>;

interface NewVersion {
  setId: string;
  params: { name: string; value: string }[];
  changelog: string;
  firmware: string | null;
  createdBy: string;
  /** Admin work is approved at once; everything else waits for review. */
  approved: boolean;
}

/**
 * The one way a version is created. The server picks the number: the row is
 * inserted first so the unique (set, label) key claims it, and a concurrent
 * save simply takes the next one. Params are de-duplicated (last wins).
 */
export async function createVersion(
  admin: Admin,
  v: NewVersion
): Promise<{ id: string; label: string } | { error: string }> {
  const params = [...new Map(v.params.map((p) => [p.name, p.value])).entries()].map(([name, value]) => ({ name, value }));
  if (params.length === 0) return { error: "The version has no params" };

  let created: { id: string; label: string } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const { data: existing } = await admin.from("param_versions").select("version_label").eq("client_set_id", v.setId);
    const label = nextLabel(existing ?? []);
    const { data, error } = await admin
      .from("param_versions")
      .insert({
        client_set_id: v.setId,
        version_label: label,
        storage_path: `${v.setId}/${label}.param`,
        changelog: v.changelog,
        created_by: v.createdBy,
        is_latest: false,
        needs_review: !v.approved,
        firmware: v.firmware,
      })
      .select("id")
      .single();
    if (data) created = { id: data.id, label };
    else if (error?.code !== "23505") return { error: error?.message ?? "Could not create the version" };
  }
  if (!created) return { error: "Another version was saved at the same moment — try again" };

  const fail = async (message: string) => {
    await admin.from("param_versions").delete().eq("id", created.id);
    return { error: message };
  };

  for (let i = 0; i < params.length; i += 500) {
    const { error } = await admin
      .from("param_values")
      .insert(params.slice(i, i + 500).map((p) => ({ param_version_id: created.id, ...p })));
    if (error) return fail(error.message);
  }

  // The label is ours, so a leftover file at this path can only be stale.
  const { error: uploadError } = await admin.storage
    .from("param-files")
    .upload(`${v.setId}/${created.label}.param`, Buffer.from(writeParamFile(params), "utf-8"), { contentType: "text/plain", upsert: true });
  if (uploadError) return fail(`Storage upload failed: ${uploadError.message}`);

  if (v.approved) {
    await admin.from("param_versions").update({ is_latest: false }).eq("client_set_id", v.setId).neq("id", created.id);
    await admin.from("param_versions").update({ is_latest: true }).eq("id", created.id);
  }
  return created;
}
