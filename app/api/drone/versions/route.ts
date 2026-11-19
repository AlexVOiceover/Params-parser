import { NextRequest, NextResponse } from "next/server";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { getCaller } from "@/lib/supabase/auth";
import { CHIP_ID_PATTERN } from "@/lib/chip-id";
import { createVersion } from "@/lib/create-version";

export const dynamic = "force-dynamic";

/**
 * POST /api/drone/versions
 * Body: { chipId, firmware, params: { name, value }[], changelog }
 *
 * "Save as new version" — anyone who can see the drone. Creates the next
 * version in the drone's own history from a live read. An admin's save is
 * approved at once; anyone else's waits for review. The version equals the
 * read by construction, so it is logged as `captured`.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const caller = await getCaller();
  if (!caller) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json() as {
    chipId?: string;
    firmware?: string | null;
    params?: { name: string; value: string }[];
    changelog?: string;
  };
  const chipId = body.chipId?.toUpperCase() ?? "";
  if (!CHIP_ID_PATTERN.test(chipId) || !Array.isArray(body.params) || body.params.length === 0) {
    return NextResponse.json({ error: "chipId and params are required" }, { status: 400 });
  }
  const changelog = body.changelog?.trim() ?? "";
  if (!changelog) return NextResponse.json({ error: "Say what changed on the drone" }, { status: 400 });

  // Authorise through the caller's session: RLS decides whether they can see this drone.
  const supabase = await createSessionClient();
  const { data: drone } = await supabase
    .from("drones")
    .select("id, serial, variant_id")
    .eq("chip_id", chipId)
    .maybeSingle();
  if (!drone) return NextResponse.json({ error: "This flight controller is not linked to a drone" }, { status: 404 });

  const { data: set } = await supabase
    .from("client_sets")
    .select("id")
    .eq("drone_id", drone.id)
    .eq("variant_id", drone.variant_id)
    .eq("is_default", false)
    .maybeSingle();
  if (!set) {
    return NextResponse.json(
      { error: `${drone.serial} has no history of its own yet — assign it to a client first.` },
      { status: 409 }
    );
  }

  const admin = createAdminClient();
  const approved = caller.role === "admin";
  const created = await createVersion(admin, {
    setId: set.id,
    params: body.params,
    changelog,
    firmware: body.firmware ?? null,
    createdBy: caller.id,
    approved,
  });
  if ("error" in created) return NextResponse.json({ error: created.error }, { status: 500 });
  const version = { id: created.id };
  const label = created.label;

  await admin.from("drone_events").insert({
    drone_id: drone.id,
    created_by: caller.id,
    param_version_id: version.id,
    chip_id: chipId,
    firmware: body.firmware ?? null,
    kind: "captured",
    diff_count: 0,
  });

  return NextResponse.json({ versionId: version.id, label, approved });
}
