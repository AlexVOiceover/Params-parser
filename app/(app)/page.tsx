import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getFleet, modelName } from "@/lib/fleet";
import { latestApproved, droneHref } from "@/lib/versions";
import { DroneList, type ModelOption } from "@/components/drone-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Drones — AIR6",
};

export default async function DronesPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? null;
  const isStaff = role === "admin" || role === "contributor";

  const rows = await getFleet(supabase);
  // A client with one drone has nothing to choose: go straight to it.
  if (!isStaff && rows.length === 1) redirect(droneHref(rows[0].serial));

  let models: ModelOption[] = [];
  let clients: { id: string; name: string }[] = [];
  if (isStaff) {
    const [{ data: variants }, { data: families }, { data: clientRows }, { data: templates }] = await Promise.all([
      supabase.from("variants").select("id, name, family_id"),
      supabase.from("families").select("id, name"),
      supabase.from("clients").select("id, name").order("name"),
      supabase.from("client_sets").select("variant_id, param_versions(id, version_label, needs_review)").eq("is_default", true),
    ]);
    const familyName = new Map((families ?? []).map((f) => [f.id, f.name]));
    const withTemplate = new Set(
      (templates ?? []).filter((t) => latestApproved(t.param_versions ?? [])).map((t) => t.variant_id)
    );
    models = (variants ?? [])
      .map((v) => ({ id: v.id, name: modelName(v.family_id ? familyName.get(v.family_id) : null, v.name), hasTemplate: withTemplate.has(v.id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    clients = clientRows ?? [];
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <DroneList
        rows={rows}
        isStaff={isStaff}
        isAdmin={role === "admin"}
        models={models}
        clients={clients}
        initialClientId={client ?? null}
      />
    </div>
  );
}
