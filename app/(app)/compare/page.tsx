import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient, createAdminClient, createSessionClient } from "@/lib/supabase/server";
import { parseParamFile } from "@/lib/param-engine";
import { VersionTree } from "@/components/compare/version-tree";
import { CompareTableWrapper } from "@/components/compare/compare-table-wrapper";
import { DRONE_VERSION_ID } from "@/lib/drone-params-shared";
import type { CompareVersion, CompareRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compare — AIR6",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface VersionNode {
  id: string;
  label: string;
  isLatest: boolean;
}

interface ClientSetNode {
  id: string;
  name: string;
  versions: VersionNode[];
}

interface VariantNode {
  id: string;
  name: string;
  clientSets: ClientSetNode[];
}

interface FamilyNode {
  id: string;
  name: string;
  slug: string;
  variants: VariantNode[];
}

// ── Selection branch: full hierarchy for version tree ─────────────────────────

type VariantRow = { id: string; name: string; family_id: string | null };
type ClientSetRow = { id: string; client_name: string; serial: string; variant_id: string };
type VersionRow = { id: string; version_label: string; is_latest: boolean; client_set_id: string };

async function fetchTree(): Promise<FamilyNode[]> {
  const supabase = await createSessionClient().catch(() => createClient());

  const { data: families } = await supabase
    .from("families")
    .select("id, name, slug")
    .order("name");

  if (!families?.length) return [];

  const familyIds = families.map((f) => f.id);
  const { data: variantsRaw } = await supabase
    .from("variants")
    .select("id, name, family_id")
    .in("family_id", familyIds)
    .not("family_id", "is", null)
    .order("name");

  const variants: VariantRow[] = variantsRaw ?? [];
  const variantIds = variants.map((v) => v.id);

  let clientSets: ClientSetRow[] = [];
  if (variantIds.length) {
    const { data } = await supabase
      .from("client_sets")
      .select("id, client_name, serial, variant_id")
      .in("variant_id", variantIds)
      .order("client_name")
      .order("serial");
    clientSets = data ?? [];
  }

  const clientSetIds = clientSets.map((c) => c.id);
  let versions: VersionRow[] = [];
  if (clientSetIds.length) {
    const { data } = await supabase
      .from("param_versions")
      .select("id, version_label, is_latest, client_set_id")
      .in("client_set_id", clientSetIds)
      .order("version_label");
    versions = data ?? [];
  }

  const variantsByFamily = new Map<string, VariantRow[]>();
  for (const v of variants) {
    if (!v.family_id) continue;
    const arr = variantsByFamily.get(v.family_id) ?? [];
    arr.push(v);
    variantsByFamily.set(v.family_id, arr);
  }

  const clientSetsByVariant = new Map<string, ClientSetRow[]>();
  for (const c of clientSets) {
    const arr = clientSetsByVariant.get(c.variant_id) ?? [];
    arr.push(c);
    clientSetsByVariant.set(c.variant_id, arr);
  }

  const versionsByClientSet = new Map<string, VersionRow[]>();
  for (const v of versions) {
    const arr = versionsByClientSet.get(v.client_set_id) ?? [];
    arr.push(v);
    versionsByClientSet.set(v.client_set_id, arr);
  }

  return families
    .map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      variants: (variantsByFamily.get(f.id) ?? [])
        .map((v) => ({
          id: v.id,
          name: v.name,
          clientSets: (clientSetsByVariant.get(v.id) ?? [])
            .map((c) => ({
              id: c.id,
              name: c.serial ? `${c.client_name} · ${c.serial}` : c.client_name,
              versions: (versionsByClientSet.get(c.id) ?? []).map((ver) => ({
                id: ver.id,
                label: ver.version_label,
                isLatest: ver.is_latest,
              })),
            }))
            .filter((c) => c.versions.length > 0),
        }))
        .filter((v) => v.clientSets.length > 0),
    }))
    .filter((f) => f.variants.length > 0);
}

// ── Compare branch: param values for selected versions ────────────────────────

async function fetchCompareData(
  versionIds: string[]
): Promise<{ versions: CompareVersion[]; rows: CompareRow[] }> {
  const supabase = await createSessionClient().catch(() => createClient());
  const admin = createAdminClient();

  const [{ data: versionsData }, { data: paramValuesData }] = await Promise.all([
    supabase
      .from("param_versions")
      .select("id, version_label, client_set_id, storage_path")
      .in("id", versionIds),
    supabase
      .from("param_values")
      .select("param_version_id, name, value")
      .in("param_version_id", versionIds)
      .order("name"),
  ]);

  const clientSetIds = [...new Set((versionsData ?? []).map((v) => v.client_set_id))];
  const { data: clientSetsData } = clientSetIds.length
    ? await supabase.from("client_sets").select("id, client_name, serial, variant_id").in("id", clientSetIds)
    : { data: [] };

  const variantIds = [...new Set((clientSetsData ?? []).map((c) => c.variant_id))];
  const { data: variantsData } = variantIds.length
    ? await supabase.from("variants").select("id, name, family_id").in("id", variantIds)
    : { data: [] };

  const familyIds = [
    ...new Set(
      (variantsData ?? []).map((v) => v.family_id).filter((id): id is string => id !== null)
    ),
  ];
  const { data: familiesData } = familyIds.length
    ? await supabase.from("families").select("id, name").in("id", familyIds)
    : { data: [] };

  const clientSetMap = new Map((clientSetsData ?? []).map((c) => [c.id, c]));
  const variantMap = new Map((variantsData ?? []).map((v) => [v.id, v]));
  const familyMap = new Map((familiesData ?? []).map((f) => [f.id, f]));
  const versionLookup = new Map((versionsData ?? []).map((v) => [v.id, v]));

  const versions: CompareVersion[] = versionIds.map((id) => {
    const v = versionLookup.get(id);
    const clientSet = v ? clientSetMap.get(v.client_set_id) : undefined;
    const variant = clientSet ? variantMap.get(clientSet.variant_id) : undefined;
    const family = variant?.family_id ? familyMap.get(variant.family_id) : undefined;
    return {
      id,
      label: v?.version_label ?? "?",
      clientName: clientSet
        ? (clientSet.serial ? `${clientSet.client_name} · ${clientSet.serial}` : clientSet.client_name)
        : "?",
      variantName: variant?.name ?? "?",
      familyName: family?.name ?? "?",
    };
  });

  // Pivot param_values into rows
  const rowMap = new Map<string, Record<string, string>>();
  for (const pv of paramValuesData ?? []) {
    if (!rowMap.has(pv.name)) rowMap.set(pv.name, {});
    rowMap.get(pv.name)![pv.param_version_id] = pv.value;
  }

  // Which versions have no param_values? Fall back to downloading the .param file.
  const coveredVersionIds = new Set((paramValuesData ?? []).map((pv) => pv.param_version_id));
  const uncoveredIds = versionIds.filter((id) => !coveredVersionIds.has(id));

  await Promise.all(
    uncoveredIds.map(async (id) => {
      const v = versionLookup.get(id);
      if (!v?.storage_path) return;
      const { data: fileData } = await admin.storage
        .from("param-files")
        .download(v.storage_path);
      if (!fileData) return;
      const text = await fileData.text();
      for (const { name, value } of parseParamFile(text)) {
        if (!rowMap.has(name)) rowMap.set(name, {});
        rowMap.get(name)![id] = value;
      }
    })
  );

  const rows: CompareRow[] = Array.from(rowMap.entries()).map(([name, values]) => ({
    name,
    values,
  }));

  return { versions, rows };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string | string[] }>;
}) {
  const { v } = await searchParams;
  const allIds = Array.isArray(v) ? v : v ? [v] : [];
  const hasDroneVersion = allIds.includes(DRONE_VERSION_ID);
  const dbVersionIds = allIds.filter((id) => id !== DRONE_VERSION_ID);

  if (dbVersionIds.length >= 1 || hasDroneVersion) {
    const { versions, rows } = dbVersionIds.length > 0
      ? await fetchCompareData(dbVersionIds)
      : { versions: [], rows: [] };
    const totalCount = versions.length + (hasDroneVersion ? 1 : 0);
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-1.5 px-6 py-3 border-b border-border text-xs text-muted-foreground shrink-0">
          <Link href="/" className="hover:text-foreground transition-colors cursor-pointer">
            Catalog
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link
            href="/compare"
            className="hover:text-foreground transition-colors cursor-pointer"
          >
            Compare
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">
            {totalCount} version{totalCount !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex-1 overflow-hidden">
          <CompareTableWrapper
            versions={versions}
            rows={rows}
            hasDroneVersion={hasDroneVersion}
          />
        </div>
      </div>
    );
  }

  const tree = await fetchTree();
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1.5 px-6 py-3 border-b border-border text-xs text-muted-foreground shrink-0">
        <Link href="/" className="hover:text-foreground transition-colors cursor-pointer">Catalog</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Compare</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <VersionTree tree={tree} />
      </div>
    </div>
  );
}
