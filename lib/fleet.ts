import type { createSessionClient } from "@/lib/supabase/server";
import { latestApproved, pendingProposal } from "@/lib/versions";

type Supabase = Awaited<ReturnType<typeof createSessionClient>>;

/**
 * What we know about a drone without it being plugged in, from its history and
 * its last verified connect. Ordered by how much attention it needs.
 */
export type FleetStatus = "review" | "behind" | "unverified" | "not_linked" | "no_version" | "up_to_date";

export const STATUS_ORDER: FleetStatus[] = ["review", "behind", "unverified", "not_linked", "no_version", "up_to_date"];

export interface FleetRow {
  id: string;
  serial: string;
  variantId: string;
  modelName: string;
  clientId: string | null;
  clientName: string | null;
  linked: boolean;
  target: string | null;
  pending: string | null;
  /** Version the drone was last verified on, and when. */
  lastLabel: string | null;
  lastAt: string | null;
  status: FleetStatus;
}

interface VersionRow { id: string; client_set_id: string; version_label: string; needs_review: boolean }

/** Model display name: "AIR4Rugged · Base", or just the family when the variant is the only "Base". */
export function modelName(family: string | null | undefined, variant: string | null | undefined): string {
  if (!family) return variant ?? "—";
  if (!variant) return family;
  return `${family} · ${variant}`;
}

/**
 * `lastVersionId`: undefined when the drone was never verified; null when the
 * version it was verified on has since been deleted.
 */
export function fleetStatus(linked: boolean, targetId: string | null, hasProposal: boolean, lastVersionId: string | null | undefined): FleetStatus {
  if (hasProposal) return "review";
  if (!targetId) return "no_version";
  if (!linked) return "not_linked";
  if (lastVersionId === undefined) return "unverified";
  return lastVersionId === targetId ? "up_to_date" : "behind";
}

/** Every drone the caller may see (RLS), with its status. */
export async function getFleet(supabase: Supabase): Promise<FleetRow[]> {
  const [{ data: drones }, { data: variants }, { data: families }, { data: clients }, { data: sets }] = await Promise.all([
    supabase.from("drones").select("id, serial, client_id, variant_id, chip_id").order("serial"),
    supabase.from("variants").select("id, name, family_id"),
    supabase.from("families").select("id, name"),
    supabase.from("clients").select("id, name"),
    supabase.from("client_sets").select("id, drone_id").eq("is_default", false).not("drone_id", "is", null),
  ]);
  const list = drones ?? [];
  if (list.length === 0) return [];

  const setIds = (sets ?? []).map((s) => s.id);
  const droneIds = list.map((d) => d.id);
  const [{ data: versions }, { data: events }] = await Promise.all([
    setIds.length
      ? supabase.from("param_versions").select("id, client_set_id, version_label, needs_review").in("client_set_id", setIds)
      : Promise.resolve({ data: [] as VersionRow[] }),
    supabase
      .from("drone_events")
      .select("drone_id, param_version_id, created_at")
      .in("drone_id", droneIds)
      .in("kind", ["applied", "captured"])
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const familyName = new Map((families ?? []).map((f) => [f.id, f.name]));
  const variantById = new Map((variants ?? []).map((v) => [v.id, v]));
  const clientName = new Map((clients ?? []).map((c) => [c.id, c.name]));
  const setByDrone = new Map((sets ?? []).map((s) => [s.drone_id as string, s.id]));
  const versionsBySet = new Map<string, VersionRow[]>();
  const labelById = new Map<string, string>();
  for (const v of (versions ?? []) as VersionRow[]) {
    labelById.set(v.id, v.version_label);
    versionsBySet.set(v.client_set_id, [...(versionsBySet.get(v.client_set_id) ?? []), v]);
  }
  const lastEvent = new Map<string, { param_version_id: string | null; created_at: string }>();
  for (const e of events ?? []) if (!lastEvent.has(e.drone_id)) lastEvent.set(e.drone_id, e);

  const rows = list.map((d): FleetRow => {
    const variant = variantById.get(d.variant_id);
    const history = versionsBySet.get(setByDrone.get(d.id) ?? "") ?? [];
    const target = latestApproved(history);
    const pending = pendingProposal(history);
    const last = lastEvent.get(d.id);
    const lastLabel = last?.param_version_id ? labelById.get(last.param_version_id) ?? null : null;

    const status = fleetStatus(!!d.chip_id, target?.id ?? null, !!pending, last ? last.param_version_id : undefined);

    return {
      id: d.id,
      serial: d.serial,
      variantId: d.variant_id,
      modelName: modelName(variant?.family_id ? familyName.get(variant.family_id) : null, variant?.name),
      clientId: d.client_id,
      clientName: d.client_id ? clientName.get(d.client_id) ?? null : null,
      linked: !!d.chip_id,
      target: target?.version_label ?? null,
      pending: pending?.version_label ?? null,
      lastLabel,
      lastAt: last?.created_at ?? null,
      status,
    };
  });

  return rows.sort((a, b) =>
    STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.serial.localeCompare(b.serial)
  );
}
