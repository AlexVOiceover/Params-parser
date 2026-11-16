import { NextRequest, NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { requireContributor } from "@/lib/supabase/auth";
import { parseChipIdInput } from "@/lib/chip-id";
import type { LinkMethod } from "@/lib/types";

export const dynamic = "force-dynamic";

const METHODS: readonly LinkMethod[] = ["connect", "messages_line", "assembly"];

/**
 * POST /api/admin/drones/[id]/link
 * Body: { chipId, method, firmware? } — chipId may also be a Mission Planner Messages line.
 *
 * Staff only. Links a drone record to a flight controller. Re-linking a drone
 * that already has a chip (FC replaced) is admin-only. A chip linked to
 * another drone is refused: unlink it there first.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const caller = await requireContributor();
  if (!caller) return NextResponse.json({ error: "Only staff can link flight controllers" }, { status: 403 });
  const { id } = await params;

  const body = await request.json() as { chipId?: string; method?: LinkMethod; firmware?: string | null };
  const chipId = parseChipIdInput(body.chipId ?? "");
  if (!chipId) {
    return NextResponse.json(
      { error: "Not a chip ID. Paste the 24-character ID, or the Mission Planner Messages line that starts with the board name." },
      { status: 400 }
    );
  }
  if (!body.method || !METHODS.includes(body.method)) {
    return NextResponse.json({ error: "Unknown link method" }, { status: 400 });
  }

  const supabase = await createSessionClient();
  const { data: drone } = await supabase.from("drones").select("id, serial, chip_id").eq("id", id).maybeSingle();
  if (!drone) return NextResponse.json({ error: "Drone not found" }, { status: 404 });
  if (drone.chip_id === chipId) return NextResponse.json({ chipId });

  const { data: other } = await supabase.from("drones").select("serial").eq("chip_id", chipId).maybeSingle();
  if (other) {
    return NextResponse.json(
      { error: `This flight controller is already linked to ${other.serial}. Unlink it there first.` },
      { status: 409 }
    );
  }

  const relink = drone.chip_id !== null;
  if (relink && caller.role !== "admin") {
    return NextResponse.json(
      { error: `${drone.serial} is already linked to another flight controller. Only an admin can re-link it.` },
      { status: 403 }
    );
  }

  const { error: updateError } = await supabase.from("drones").update({ chip_id: chipId }).eq("id", id);
  if (updateError) {
    const conflict = updateError.code === "23505";
    return NextResponse.json(
      { error: conflict ? "This flight controller is already linked to another drone." : updateError.message },
      { status: conflict ? 409 : 500 }
    );
  }

  await supabase.from("drone_events").insert({
    drone_id: id,
    chip_id: chipId,
    firmware: body.firmware ?? null,
    kind: relink ? "relinked" : "linked",
    method: body.method,
  });

  return NextResponse.json({ chipId });
}

/** DELETE — staff only: remove a wrong link. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const caller = await requireContributor();
  if (!caller) return NextResponse.json({ error: "Only staff can unlink flight controllers" }, { status: 403 });
  const { id } = await params;

  const supabase = await createSessionClient();
  const { data: drone } = await supabase.from("drones").select("chip_id").eq("id", id).maybeSingle();
  if (!drone) return NextResponse.json({ error: "Drone not found" }, { status: 404 });
  if (!drone.chip_id) return NextResponse.json({ ok: true });

  const { error } = await supabase.from("drones").update({ chip_id: null }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("drone_events").insert({ drone_id: id, chip_id: drone.chip_id, kind: "unlinked" });
  return NextResponse.json({ ok: true });
}
