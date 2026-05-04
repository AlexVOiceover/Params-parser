import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { UploadForm, type UploadFormData } from "@/components/upload-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Upload — AIR6",
};

export default async function UploadPage() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_id")
    .eq("id", user.id)
    .single();

  if (!profile || !["contributor", "admin", "client"].includes(profile.role)) {
    redirect("/");
  }
  if (profile.role === "client" && !profile.client_id) {
    redirect("/");
  }
  const role = profile.role as "admin" | "contributor" | "client";
  const userClientId = profile.client_id as string | null;

  const admin = createAdminClient();
  const [
    { data: clientsData },
    { data: dronesData },
    { data: familiesData },
    { data: variantsData },
    { data: clientSetsData },
  ] = await Promise.all([
    admin.from("clients").select("id, name").order("name"),
    admin.from("drones").select("id, client_id, variant_id, serial").order("serial"),
    admin.from("families").select("id, slug, name").order("name"),
    admin.from("variants").select("id, name, family_id").order("name"),
    admin.from("client_sets").select("id, client_id, drone_id, variant_id"),
  ]);

  // Latest version per client_set, used to suggest the next version number.
  const setIds = (clientSetsData ?? []).map((cs) => cs.id);
  const { data: versionsData } = setIds.length
    ? await admin
        .from("param_versions")
        .select("client_set_id, version_label")
        .in("client_set_id", setIds)
    : { data: [] };

  // Largest existing major version per client_set
  const maxMajorByClientSet = new Map<string, number>();
  for (const v of versionsData ?? []) {
    const m = /^(\d+)\.\d+$/.exec(v.version_label);
    if (!m) continue;
    const major = parseInt(m[1], 10);
    const cur = maxMajorByClientSet.get(v.client_set_id) ?? 0;
    if (major > cur) maxMajorByClientSet.set(v.client_set_id, major);
  }

  // Default client_sets keyed by variant_id (one per variant). Used for "Default" upload mode.
  const { data: defaultClientSetsData } = await admin
    .from("client_sets")
    .select("id, variant_id")
    .eq("is_default", true);

  // Client users only ever see their own company and drones.
  const visibleClients = role === "client"
    ? (clientsData ?? []).filter((c) => c.id === userClientId)
    : (clientsData ?? []);
  const visibleDrones = role === "client"
    ? (dronesData ?? []).filter((d) => d.client_id === userClientId)
    : (dronesData ?? []);

  const data: UploadFormData = {
    clients: visibleClients,
    drones: visibleDrones,
    families: familiesData ?? [],
    variants: (variantsData ?? []).map((v) => ({
      id: v.id,
      name: v.name,
      family_id: v.family_id ?? "",
    })),
    clientSets: (clientSetsData ?? []).map((cs) => ({
      id: cs.id,
      client_id: cs.client_id ?? "",
      drone_id: cs.drone_id ?? "",
      variant_id: cs.variant_id,
      nextMajor: (maxMajorByClientSet.get(cs.id) ?? 0) + 1,
    })),
    defaultClientSets: (defaultClientSetsData ?? []).map((cs) => ({
      id: cs.id,
      variant_id: cs.variant_id,
      nextMajor: (maxMajorByClientSet.get(cs.id) ?? 0) + 1,
    })),
  };

  return <UploadForm data={data} role={role} userClientId={userClientId} />;
}
