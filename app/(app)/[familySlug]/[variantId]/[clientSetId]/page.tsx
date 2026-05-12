import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createSessionClient } from "@/lib/supabase/server";
import { ParamVersionList } from "@/components/param-version-list";
import { RUNTIME_PARAMS } from "@/lib/param-engine";
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
      .select("id, client_name, serial, description, created_at, updated_at, created_by, variant_id, client_id, drone_id, is_default")
      .eq("id", clientSetId)
      .maybeSingle(),
    supabase
      .from("param_versions")
      .select("id, client_set_id, version_label, storage_path, changelog, created_by, created_at, is_latest, needs_review")
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

  // Compute diff-vs-previous-version for each version.
  const versionList = (versions as ParamVersion[]) ?? [];
  const diffVsPrev = new Map<string, number>();

  if (versionList.length > 1) {
    const PAGE_SIZE = 500;

    // Fetch each version separately to avoid pagination boundary issues
    // that occur when fetching multiple versions together with .in()
    const byVersion = new Map<string, Map<string, string>>();
    for (const v of versionList) {
      const paramMap = new Map<string, string>();
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data: page } = await supabase
          .from("param_values")
          .select("name, value")
          .eq("param_version_id", v.id)
          .order("name")
          .range(from, from + PAGE_SIZE - 1);
        if (!page || page.length === 0) break;
        for (const { name, value } of page) paramMap.set(name, value);
        if (page.length < PAGE_SIZE) break;
      }
      byVersion.set(v.id, paramMap);
    }

    // Sort oldest first, diff each against its predecessor
    const sorted = [...versionList].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    for (let i = 1; i < sorted.length; i++) {
      const prev = byVersion.get(sorted[i - 1].id) ?? new Map<string, string>();
      const curr = byVersion.get(sorted[i].id) ?? new Map<string, string>();
      const allNames = new Set([...prev.keys(), ...curr.keys()]);
      let diff = 0;
      for (const name of allNames) {
        if (RUNTIME_PARAMS.has(name)) continue;
        if (prev.get(name) !== curr.get(name)) diff++;
      }
      diffVsPrev.set(sorted[i].id, diff);
    }
  }

  return {
    family: family as Family | null,
    variant: variant as Variant | null,
    clientSet: resolvedClientSet,
    versions: versionList,
    diffVsPrev: Object.fromEntries(diffVsPrev),
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
  const { family, variant, clientSet, versions, diffVsPrev } = await getData(familySlug, variantId, clientSetId);

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
        droneId={(clientSet as ClientSet & { drone_id: string | null })?.drone_id ?? null}
        diffVsPrev={diffVsPrev}
        familyName={family.name}
        variantName={variant.name}
        clientSetName={clientSet.serial ? `${clientSet.client_name} · ${clientSet.serial}` : clientSet.client_name}
      />
    </div>
  );
}
