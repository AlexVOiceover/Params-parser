import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { ReviewQueue, type ReviewRow } from "@/components/review-queue";
import { latestApproved, droneHref, modelHref } from "@/lib/versions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review — AIR6",
};

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
  const [{ data: drones }, { data: variants }, { data: authors }] = await Promise.all([
    droneIds.length ? supabase.from("drones").select("id, serial").in("id", droneIds) : Promise.resolve({ data: [] }),
    variantIds.length ? supabase.from("variants").select("id, name") .in("id", variantIds) : Promise.resolve({ data: [] }),
    authorIds.length ? createAdminClient().from("profiles").select("id, username").in("id", authorIds) : Promise.resolve({ data: [] }),
  ]);
  const setById = new Map((sets ?? []).map((s) => [s.id, s]));
  const serialById = new Map((drones ?? []).map((d) => [d.id, d.serial]));
  const variantName = new Map((variants ?? []).map((v) => [v.id, v.name]));
  const authorName = new Map((authors ?? []).map((a) => [a.id, a.username]));

  const rows: ReviewRow[] = list.map((p) => {
    const set = setById.get(p.client_set_id);
    const serial = set?.drone_id ? serialById.get(set.drone_id) ?? null : null;
    const target = latestApproved((siblings ?? []).filter((s) => s.client_set_id === p.client_set_id));
    return {
      id: p.id,
      label: p.version_label,
      createdAt: p.created_at,
      changelog: p.changelog,
      author: p.created_by ? authorName.get(p.created_by) ?? null : null,
      subject: serial ?? `${variantName.get(set?.variant_id ?? "") ?? "Model"} template`,
      href: serial ? droneHref(serial) : modelHref(set?.variant_id ?? ""),
      targetId: target?.id ?? null,
      targetLabel: target?.version_label ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
      <h1 className="text-xl font-semibold text-foreground">Review</h1>
      <p className="text-sm text-muted-foreground mt-0.5 mb-6">
        Versions proposed by clients and staff. Approving one makes it the target; the drone is offered it on its next connect.
      </p>
      <ReviewQueue rows={rows} />
    </div>
  );
}
