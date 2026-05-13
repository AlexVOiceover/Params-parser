import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { parseSerialId } from "@/lib/param-engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/drone/match?id=<int>[&scr_user2=<int>]
 *
 * Looks up a drone whose serial-trailing-integer equals `id`, scoped by RLS
 * to the calling user's accessible set. Returns:
 *   { drone: { ...identity, catalog_version, drone_version } }
 *   { drone: null } when no unique match (zero or many).
 *
 * catalog_version: latest version integer in the drone's client_set, or null.
 * drone_version:   the scr_user2 param echoed back as an integer, or null.
 */
export async function GET(request: NextRequest) {
  const idParam = request.nextUrl.searchParams.get("id");
  if (!idParam) return NextResponse.json({ drone: null });
  const wanted = parseInt(idParam, 10);
  if (!Number.isFinite(wanted)) return NextResponse.json({ drone: null });

  const scrUser2Param = request.nextUrl.searchParams.get("scr_user2");
  const droneVersion = scrUser2Param !== null ? parseInt(scrUser2Param, 10) : null;
  // 0 is ArduPilot's factory default for SCR_USER2 — treat as "not set".
  const droneVersionOut = (droneVersion !== null && Number.isFinite(droneVersion) && droneVersion !== 0)
    ? droneVersion
    : null;

  const supabase = await createSessionClient();
  const { data: drones } = await supabase
    .from("drones")
    .select("id, serial, client_id, variant_id, initialised_at");

  const matches = (drones ?? []).filter((d) => parseSerialId(d.serial) === wanted);
  if (matches.length !== 1) return NextResponse.json({ drone: null });
  const drone = matches[0];

  // Resolve labels + catalog version in parallel.
  const [{ data: client }, { data: variant }, { data: clientSet }] = await Promise.all([
    drone.client_id
      ? supabase.from("clients").select("name").eq("id", drone.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("variants").select("name, family_id").eq("id", drone.variant_id).maybeSingle(),
    supabase
      .from("client_sets")
      .select("id")
      .eq("drone_id", drone.id)
      .eq("variant_id", drone.variant_id)
      .maybeSingle(),
  ]);

  let familyName: string | null = null;
  let familySlug: string | null = null;
  if (variant?.family_id) {
    const { data: family } = await supabase
      .from("families")
      .select("slug, name")
      .eq("id", variant.family_id)
      .maybeSingle();
    familyName = family?.name ?? null;
    familySlug = family?.slug ?? null;
  }

  let catalogVersion: number | null = null;
  let latestVersionId: string | null = null;

  // Secondary lookup: if no client_set found by drone_id, try client_id + variant_id.
  // This handles the case where drone_id FK was set incorrectly (backfill era data).
  const clientSetByClient = (!clientSet && drone.client_id) ? await (async () => {
    const { data } = await supabase
      .from("client_sets")
      .select("id")
      .eq("variant_id", drone.variant_id)
      .eq("client_id", drone.client_id)
      .eq("is_default", false)
      .maybeSingle();
    return data;
  })() : null;

  const resolvedNonDefaultClientSet = clientSet ?? clientSetByClient;

  // isOrphan: drone has no client_set on this variant — fall back to the
  // variant's Default client_set so orphan drones still get version tracking.
  const isOrphan = !resolvedNonDefaultClientSet;
  const resolvedClientSet = resolvedNonDefaultClientSet ?? await (async () => {
    const { data } = await supabase
      .from("client_sets")
      .select("id")
      .eq("variant_id", drone.variant_id)
      .eq("is_default", true)
      .maybeSingle();
    return data;
  })();

  if (resolvedClientSet) {
    const { data: latestVersion } = await supabase
      .from("param_versions")
      .select("id, version_label")
      .eq("client_set_id", resolvedClientSet.id)
      .eq("is_latest", true)
      .maybeSingle();
    if (latestVersion) {
      const n = parseInt(latestVersion.version_label, 10);
      if (Number.isFinite(n)) catalogVersion = n;
      latestVersionId = latestVersion.id;
    }
  }

  return NextResponse.json({
    drone: {
      id: drone.id,
      serial: drone.serial,
      client_id: drone.client_id,
      variant_id: drone.variant_id,
      client_name: client?.name ?? null,
      family_slug: familySlug,
      family_name: familyName,
      variant_name: variant?.name ?? null,
      catalog_version: catalogVersion,
      latest_version_id: latestVersionId,
      drone_version: droneVersionOut,
      is_orphan: isOrphan,
      drift_count: null, // populated separately via POST /api/drone/drift
      client_set_id: resolvedNonDefaultClientSet?.id ?? null,
      initialised_at: (drone as { initialised_at?: string | null }).initialised_at ?? null,
    },
  });
}
