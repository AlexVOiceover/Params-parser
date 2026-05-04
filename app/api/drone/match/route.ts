import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { parseSerialId } from "@/lib/param-engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/drone/match?id=<int>
 *
 * Looks up a drone whose serial-trailing-integer equals `id`, scoped by RLS
 * to the calling user's accessible set. Returns:
 *   { drone: { id, serial, client_id, variant_id, client_name, family_slug, family_name, variant_name } }
 *   { drone: null } when no unique match (zero or many).
 */
export async function GET(request: NextRequest) {
  const idParam = request.nextUrl.searchParams.get("id");
  if (!idParam) return NextResponse.json({ drone: null });
  const wanted = parseInt(idParam, 10);
  if (!Number.isFinite(wanted)) return NextResponse.json({ drone: null });

  const supabase = await createSessionClient();
  const { data: drones } = await supabase
    .from("drones")
    .select("id, serial, client_id, variant_id");

  const matches = (drones ?? []).filter((d) => parseSerialId(d.serial) === wanted);
  if (matches.length !== 1) return NextResponse.json({ drone: null });
  const drone = matches[0];

  // Resolve labels via FKs.
  const [{ data: client }, { data: variant }] = await Promise.all([
    drone.client_id
      ? supabase.from("clients").select("name").eq("id", drone.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("variants").select("name, family_id").eq("id", drone.variant_id).maybeSingle(),
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
    },
  });
}
