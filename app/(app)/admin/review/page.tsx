import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { ReviewQueue, type ReviewRow } from "@/components/review-queue";
import { pageLeadClass, pageTitleClass } from "@/components/ui/styles";
import { modelName } from "@/lib/fleet";
import { latestApproved, droneHref, modelHref } from "@/lib/versions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review — AIR6",
};

interface DroneRow { id: string; serial: string; client_id: string | null }
interface VariantRow { id: string; name: string; family_id: string | null }
interface NamedRow { id: string; name: string }

export default async function ReviewPage() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { data: proposals } = await supabase
    .from("param_versions")
    .select("id, version_label, created_at, changelog, created_by, client_set_id")
    .eq("needs_review", true)
    .order("created_at", { ascending: false });
  const list = proposals ?? [];
  const setIds = [...new Set(list.map((p) => p.client_set_id))];

  const [{ data: sets }, { data: siblings }] = await Promise.all([
    setIds.length
      ? supabase.from("client_sets").select("id, is_default, variant_id, drone_id, client_name").in("id", setIds)
      : Promise.resolve({ data: [] }),
    setIds.length
      ? supabase.from("param_versions").select("id, client_set_id, version_label, needs_review").in("client_set_id", setIds)
      : Promise.resolve({ data: [] }),
  ]);
  const droneIds = (sets ?? []).map((s) => s.drone_id).filter((id): id is string => !!id);
  const variantIds = [...new Set((sets ?? []).map((s) => s.variant_id))];
  const authorIds = [...new Set(list.map((p) => p.created_by).filter((id): id is string => !!id))];
  const [{ data: droneData }, { data: variantData }, { data: authors }] = await Promise.all([
    droneIds.length ? supabase.from("drones").select("id, serial, client_id").in("id", droneIds) : Promise.resolve({ data: [] }),
    variantIds.length ? supabase.from("variants").select("id, name, family_id").in("id", variantIds) : Promise.resolve({ data: [] }),
    authorIds.length ? createAdminClient().from("profiles").select("id, username").in("id", authorIds) : Promise.resolve({ data: [] }),
  ]);
  const drones = (droneData ?? []) as DroneRow[];
  const variants = (variantData ?? []) as VariantRow[];

  // The names that say whose proposal it is: the drone's client, and the model's product line.
  const clientIds = [...new Set(drones.map((d) => d.client_id).filter((id): id is string => !!id))];
  const familyIds = [...new Set(variants.map((v) => v.family_id).filter((id): id is string => !!id))];
  const [{ data: clientData }, { data: familyData }] = await Promise.all([
    clientIds.length ? supabase.from("clients").select("id, name").in("id", clientIds) : Promise.resolve({ data: [] }),
    familyIds.length ? supabase.from("families").select("id, name").in("id", familyIds) : Promise.resolve({ data: [] }),
  ]);

  const setById = new Map((sets ?? []).map((s) => [s.id, s]));
  const droneById = new Map(drones.map((d) => [d.id, d]));
  const variantById = new Map(variants.map((v) => [v.id, v]));
  const clientName = new Map(((clientData ?? []) as NamedRow[]).map((c) => [c.id, c.name]));
  const familyName = new Map(((familyData ?? []) as NamedRow[]).map((f) => [f.id, f.name]));
  const authorName = new Map((authors ?? []).map((a) => [a.id, a.username]));

  const rows: ReviewRow[] = list.map((p) => {
    const set = setById.get(p.client_set_id);
    const drone = set?.drone_id ? droneById.get(set.drone_id) ?? null : null;
    const variant = variantById.get(set?.variant_id ?? "");
    const model = variant ? modelName(variant.family_id ? familyName.get(variant.family_id) : null, variant.name) : null;
    const target = latestApproved((siblings ?? []).filter((s) => s.client_set_id === p.client_set_id));
    // The approve route refuses on this same comparison, so the queue can say so up front.
    const supersededBy: string | null =
      target && parseInt(target.version_label, 10) > parseInt(p.version_label, 10) ? target.version_label : null;
    return {
      id: p.id,
      label: p.version_label,
      createdAt: p.created_at,
      changelog: p.changelog,
      author: p.created_by ? authorName.get(p.created_by) ?? null : null,
      subject: drone
        ? { kind: "drone", serial: drone.serial, client: drone.client_id ? clientName.get(drone.client_id) ?? null : null, model }
        : { kind: "template", model },
      href: drone ? droneHref(drone.serial) : modelHref(set?.variant_id ?? ""),
      targetId: target?.id ?? null,
      targetLabel: target?.version_label ?? null,
      supersededBy,
    };
  });

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div>
        <h1 className={pageTitleClass}>Review</h1>
        <p className={pageLeadClass}>
          Versions proposed by clients and staff. Approving one makes it the target; the drone is offered it on its next connect.
        </p>
      </div>
      <ReviewQueue rows={rows} />
    </div>
  );
}
