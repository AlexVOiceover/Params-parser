import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { latestApproved, pendingProposal } from "@/lib/versions";
import { ModelList, type FamilyGroup } from "@/components/model-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Models — AIR6",
};

export default async function ModelsPage() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? null;
  if (role !== "admin" && role !== "contributor") redirect("/");

  const [{ data: families }, { data: variants }, { data: templates }, { data: drones }] = await Promise.all([
    supabase.from("families").select("id, name").order("name"),
    supabase.from("variants").select("id, name, family_id").order("name"),
    supabase.from("client_sets").select("variant_id, param_versions(id, version_label, needs_review)").eq("is_default", true),
    supabase.from("drones").select("variant_id"),
  ]);
  const templateByVariant = new Map((templates ?? []).map((t) => [t.variant_id, t.param_versions ?? []]));
  const droneCount = new Map<string, number>();
  for (const d of drones ?? []) droneCount.set(d.variant_id, (droneCount.get(d.variant_id) ?? 0) + 1);

  const groups: FamilyGroup[] = (families ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    models: (variants ?? [])
      .filter((v) => v.family_id === f.id)
      .map((v) => {
        const history = templateByVariant.get(v.id) ?? [];
        return {
          id: v.id,
          name: v.name,
          template: latestApproved(history)?.version_label ?? null,
          pending: pendingProposal(history)?.version_label ?? null,
          drones: droneCount.get(v.id) ?? 0,
        };
      }),
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <ModelList families={groups} isAdmin={role === "admin"} />
    </div>
  );
}
