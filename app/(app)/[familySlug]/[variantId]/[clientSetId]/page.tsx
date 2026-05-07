import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createSessionClient } from "@/lib/supabase/server";
import { ParamVersionList } from "@/components/param-version-list";
import type { Family, Variant, ClientSet, ParamVersion } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getData(familySlug: string, variantId: string, clientSetId: string) {
  const supabase = await createSessionClient();

  const [{ data: family }, { data: variant }, { data: clientSet }, { data: versions }] = await Promise.all([
    supabase
      .from("families")
      .select("id, slug, name, description")
      .eq("slug", familySlug)
      .single(),
    supabase
      .from("variants")
      .select("id, name, description, created_at, updated_at, created_by, family_id")
      .eq("id", variantId)
      .maybeSingle(),
    supabase
      .from("client_sets")
      .select("id, client_name, serial, description, created_at, updated_at, created_by, variant_id, client_id, drone_id")
      .eq("id", clientSetId)
      .maybeSingle(),
    supabase
      .from("param_versions")
      .select("id, client_set_id, version_label, storage_path, changelog, created_by, created_at, is_latest")
      .eq("client_set_id", clientSetId)
      .order("created_at", { ascending: false }),
  ]);

  // Resolve live name + serial via FK; fall back to captured text if missing.
  let resolvedClientSet: ClientSet | null = null;
  if (clientSet) {
    const cs = clientSet as ClientSet & { client_id: string | null; drone_id: string | null };
    const [{ data: live_client }, { data: live_drone }] = await Promise.all([
      cs.client_id
        ? supabase.from("clients").select("name").eq("id", cs.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
      cs.drone_id
        ? supabase.from("drones").select("serial").eq("id", cs.drone_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    resolvedClientSet = {
      ...cs,
      client_name: live_client?.name ?? cs.client_name,
      serial: live_drone?.serial ?? cs.serial,
    };
  }

  return {
    family: family as Family | null,
    variant: variant as Variant | null,
    clientSet: resolvedClientSet,
    versions: (versions as ParamVersion[]) ?? [],
  };
}

async function getIsAdmin(): Promise<boolean> {
  try {
    const supabase = await createSessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    return data?.role === "admin";
  } catch { return false; }
}

export default async function ClientSetPage({
  params,
}: {
  params: Promise<{ familySlug: string; variantId: string; clientSetId: string }>;
}) {
  const { familySlug, variantId, clientSetId } = await params;
  const isAdmin = await getIsAdmin();
  const { family, variant, clientSet, versions } = await getData(familySlug, variantId, clientSetId);

  if (!family || !variant || !clientSet) notFound();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6 flex-wrap">
        <Link href="/" className="hover:text-foreground transition-colors cursor-pointer">Catalog</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/${familySlug}`} className="hover:text-foreground transition-colors cursor-pointer">{family.name}</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/${familySlug}/${variantId}`} className="hover:text-foreground transition-colors cursor-pointer">{variant.name}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{clientSet.client_name}</span>
        {clientSet.serial && (
          <span className="font-mono text-muted-foreground">· {clientSet.serial}</span>
        )}
      </nav>

      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">{clientSet.client_name}</h1>
          {clientSet.serial && (
            <span className="text-xs font-mono text-muted-foreground">SN {clientSet.serial}</span>
          )}
          {clientSet.description && (
            <p className="text-sm text-muted-foreground">{clientSet.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Versions{versions.length > 0 ? ` (${versions.length})` : ""}
        </h2>
      </div>

      <ParamVersionList
        versions={versions}
        familySlug={familySlug}
        familyId={family.id}
        variantId={variantId}
        clientSetId={clientSetId}
        isAdmin={isAdmin}
        isDefault={clientSet?.is_default ?? false}
        familyName={family.name}
        variantName={variant.name}
        clientSetName={clientSet.serial ? `${clientSet.client_name} · ${clientSet.serial}` : clientSet.client_name}
      />
    </div>
  );
}
