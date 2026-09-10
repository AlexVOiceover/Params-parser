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

  // /api/upload only accepts contributor and admin, so a client user would get
  // a form that can never submit. Keep the page and the route in agreement.
  if (!profile || !["contributor", "admin"].includes(profile.role)) {
    redirect("/");
  }
  // Kept as the wider union because UploadForm and the scoping below still
  // handle "client"; the redirect above is what currently excludes them.
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

  // Largest existing version per client_set (integer labels)
  const maxMajorByClientSet = new Map<string, number>();
  for (const v of versionsData ?? []) {
    const n = parseInt(v.version_label, 10);
    if (!Number.isFinite(n)) continue;
    const cur = maxMajorByClientSet.get(v.client_set_id) ?? 0;
    if (n > cur) maxMajorByClientSet.set(v.client_set_id, n);
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

  // These are read with the service-role client, which bypasses RLS, so they
  // must be re-scoped by hand — otherwise a client user's form receives every
  // client_set in the system.
  const visibleDroneIds = new Set(visibleDrones.map((d) => d.id));
  const visibleClientSets = role === "client"
    ? (clientSetsData ?? []).filter(
        (cs) => cs.client_id === userClientId || (cs.drone_id && visibleDroneIds.has(cs.drone_id))
      )
    : (clientSetsData ?? []);
  // Variants and families are only kept where the user has a drone on them.
  const visibleVariantIds = role === "client"
    ? new Set(visibleDrones.map((d) => d.variant_id))
    : null;
  const visibleVariants = visibleVariantIds
    ? (variantsData ?? []).filter((v) => visibleVariantIds.has(v.id))
    : (variantsData ?? []);
  const visibleFamilyIds = new Set(visibleVariants.map((v) => v.family_id).filter(Boolean));
  const visibleFamilies = visibleVariantIds
    ? (familiesData ?? []).filter((f) => visibleFamilyIds.has(f.id))
    : (familiesData ?? []);

  const data: UploadFormData = {
    clients: visibleClients,
    drones: visibleDrones,
    families: visibleFamilies,
    variants: (visibleVariants).map((v) => ({
      id: v.id,
      name: v.name,
      family_id: v.family_id ?? "",
    })),
    clientSets: (visibleClientSets).map((cs) => ({
      id: cs.id,
      client_id: cs.client_id ?? "",
      drone_id: cs.drone_id ?? "",
      variant_id: cs.variant_id,
      nextMajor: (maxMajorByClientSet.get(cs.id) ?? 0) + 1,
    })),
    defaultClientSets: (visibleVariantIds
      ? (defaultClientSetsData ?? []).filter((cs) => visibleVariantIds.has(cs.variant_id))
      : (defaultClientSetsData ?? [])
    ).map((cs) => ({
      id: cs.id,
      variant_id: cs.variant_id,
      nextMajor: (maxMajorByClientSet.get(cs.id) ?? 0) + 1,
    })),
  };

  return <UploadForm data={data} role={role} userClientId={userClientId} />;
}
