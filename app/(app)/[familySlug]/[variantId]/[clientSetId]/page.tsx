import { notFound, redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { droneHref, modelHref } from "@/lib/versions";

/** Old history URL: a drone's history is now its drone page; a Default is its model's template. */
export default async function OldHistoryPage({ params }: { params: Promise<{ variantId: string; clientSetId: string }> }) {
  const { variantId, clientSetId } = await params;
  const supabase = await createSessionClient();
  const { data: set } = await supabase.from("client_sets").select("drone_id, is_default").eq("id", clientSetId).maybeSingle();
  if (!set) notFound();
  if (set.drone_id) {
    const { data: drone } = await supabase.from("drones").select("serial").eq("id", set.drone_id).maybeSingle();
    if (drone) redirect(droneHref(drone.serial));
  }
  redirect(modelHref(variantId));
}
