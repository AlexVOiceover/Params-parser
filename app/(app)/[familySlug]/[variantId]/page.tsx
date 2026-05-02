import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient, createSessionClient } from "@/lib/supabase/server";
import { ClientSetList, type ClientSetCard } from "@/components/client-set-list";
import type { Family, Variant, ClientSet } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RawClientSet extends ClientSet {
  param_versions: { id: string; version_label: string; created_at: string; is_latest: boolean }[];
}

async function getData(familySlug: string, variantId: string) {
  const supabase = createClient();

  const [{ data: family }, { data: variant }, { data: clientSets }] = await Promise.all([
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
      .select("id, client_name, serial, description, created_at, updated_at, created_by, variant_id, param_versions(id, version_label, created_at, is_latest)")
      .eq("variant_id", variantId)
      .order("client_name")
      .order("serial"),
  ]);

  const sets = (clientSets as unknown as RawClientSet[]) ?? [];

  // Latest version per client set
  const latestVersionByClientSet = new Map<string, string>();
  for (const cs of sets) {
    const latest = cs.param_versions.find((pv) => pv.is_latest)
      ?? [...cs.param_versions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (latest) latestVersionByClientSet.set(cs.id, latest.id);
  }

  // Identify Default (the one with serial = "")
  const defaultSet = sets.find((cs) => cs.serial === "") ?? null;

  // Compute diff counts vs Default
  const diffCountByClientSet = new Map<string, number>();
  if (defaultSet && latestVersionByClientSet.has(defaultSet.id)) {
    const versionIds = [...latestVersionByClientSet.values()];
    const { data: paramValues } = await supabase
      .from("param_values")
      .select("param_version_id, name, value")
      .in("param_version_id", versionIds);

    // Pivot: name → versionId → value
    const valuesByVersion = new Map<string, Map<string, string>>();
    for (const pv of paramValues ?? []) {
      let m = valuesByVersion.get(pv.param_version_id);
      if (!m) {
        m = new Map();
        valuesByVersion.set(pv.param_version_id, m);
      }
      m.set(pv.name, pv.value);
    }

    const defaultVersionId = latestVersionByClientSet.get(defaultSet.id)!;
    const defaultValues = valuesByVersion.get(defaultVersionId) ?? new Map<string, string>();

    for (const [csId, versionId] of latestVersionByClientSet.entries()) {
      if (csId === defaultSet.id) continue;
      const csValues = valuesByVersion.get(versionId) ?? new Map<string, string>();
      const allNames = new Set<string>([...defaultValues.keys(), ...csValues.keys()]);
      let diff = 0;
      for (const name of allNames) {
        if (defaultValues.get(name) !== csValues.get(name)) diff++;
      }
      diffCountByClientSet.set(csId, diff);
    }
  }

  // Shape the cards for the component
  const cards: ClientSetCard[] = sets.map((cs) => ({
    id: cs.id,
    client_name: cs.client_name,
    serial: cs.serial,
    description: cs.description,
    updated_at: cs.updated_at,
    versions: cs.param_versions.map((pv) => ({
      version_label: pv.version_label,
      created_at: pv.created_at,
    })),
    latestVersionId: latestVersionByClientSet.get(cs.id) ?? null,
    diffCount: diffCountByClientSet.get(cs.id) ?? null,
    isDefault: cs === defaultSet,
  }));

  return {
    family: family as Family | null,
    variant: variant as Variant | null,
    cards,
    defaultLatestVersionId: defaultSet ? latestVersionByClientSet.get(defaultSet.id) ?? null : null,
  };
}

async function getRole(): Promise<string | null> {
  try {
    const supabase = await createSessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    return data?.role ?? null;
  } catch { return null; }
}

export default async function VariantPage({
  params,
}: {
  params: Promise<{ familySlug: string; variantId: string }>;
}) {
  const { familySlug, variantId } = await params;
  const [role, data] = await Promise.all([getRole(), getData(familySlug, variantId)]);
  const isAdmin = role === "admin";
  const canCreate = role === "admin" || role === "contributor";
  const { family, variant, cards, defaultLatestVersionId } = data;

  if (!family || !variant) notFound();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6 flex-wrap">
        <Link href="/" className="hover:text-foreground transition-colors cursor-pointer">Catalog</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/${familySlug}`} className="hover:text-foreground transition-colors cursor-pointer">{family.name}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{variant.name}</span>
      </nav>

      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-1">{variant.name}</h1>
          {variant.description && (
            <p className="text-sm text-muted-foreground">{variant.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Client sets{cards.length > 0 ? ` (${cards.length})` : ""}
        </h2>
      </div>

      {cards.length === 0 && !canCreate ? (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No client sets for this variant yet.</p>
        </div>
      ) : (
        <ClientSetList
          familySlug={familySlug}
          variantId={variantId}
          clientSets={cards}
          defaultLatestVersionId={defaultLatestVersionId}
          isAdmin={isAdmin}
          canCreate={canCreate}
        />
      )}
    </div>
  );
}
