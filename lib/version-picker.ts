import type { createSessionClient } from "@/lib/supabase/server";
import { latestApproved } from "@/lib/versions";
import { modelName } from "@/lib/fleet";

type Supabase = Awaited<ReturnType<typeof createSessionClient>>;

export interface PickerVersion {
  id: string;
  label: string;
  createdAt: string;
  changelog: string | null;
  needsReview: boolean;
  /** The approved version with the highest number: a drone's target, or a model's current template. */
  isTarget: boolean;
}

/** One history that versions can be picked from: a drone's, or a model's template. */
export interface PickerHistory {
  id: string;
  kind: "drone" | "template";
  variantId: string;
  modelName: string;
  serial: string | null;
  clientName: string | null;
  /** Newest first. */
  versions: PickerVersion[];
}

/** Every history the caller may see (RLS) that has at least one version. */
export async function getPickerHistories(supabase: Supabase): Promise<PickerHistory[]> {
  const [{ data: sets }, { data: variants }, { data: families }, { data: clients }, { data: drones }] = await Promise.all([
    supabase.from("client_sets").select("id, client_name, serial, variant_id, client_id, drone_id, is_default"),
    supabase.from("variants").select("id, name, family_id"),
    supabase.from("families").select("id, name"),
    supabase.from("clients").select("id, name"),
    supabase.from("drones").select("id, serial"),
  ]);
  const list = sets ?? [];
  if (list.length === 0) return [];
  const { data: versions } = await supabase
    .from("param_versions")
    .select("id, version_label, needs_review, client_set_id, created_at, changelog")
    .in("client_set_id", list.map((s) => s.id));

  const familyName = new Map((families ?? []).map((f) => [f.id, f.name]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const droneSerial = new Map((drones ?? []).map((d) => [d.id, d.serial]));

  return list
    .map((s): PickerHistory => {
      const own = (versions ?? []).filter((v) => v.client_set_id === s.id);
      const target = latestApproved(own);
      const variant = variantById.get(s.variant_id);
      return {
        id: s.id,
        kind: s.is_default ? "template" : "drone",
        variantId: s.variant_id,
        modelName: modelName(variant?.family_id ? familyName.get(variant.family_id) : null, variant?.name),
        // Live names, so a renamed client or serial shows as it is now.
        serial: s.is_default ? null : (s.drone_id && droneSerial.get(s.drone_id)) || s.serial || null,
        clientName: s.is_default ? null : (s.client_id && clientName.get(s.client_id)) || s.client_name || null,
        versions: own
          .sort((a, b) => parseInt(b.version_label, 10) - parseInt(a.version_label, 10))
          .map((v) => ({
            id: v.id,
            label: v.version_label,
            createdAt: v.created_at,
            changelog: v.changelog,
            needsReview: v.needs_review,
            isTarget: target?.id === v.id,
          })),
      };
    })
    .filter((h) => h.versions.length > 0)
    .sort((a, b) =>
      a.modelName.localeCompare(b.modelName)
      || (a.kind === b.kind ? 0 : a.kind === "template" ? -1 : 1)
      || (a.serial ?? "").localeCompare(b.serial ?? "")
    );
}
