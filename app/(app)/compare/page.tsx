import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient, createAdminClient, createSessionClient } from "@/lib/supabase/server";
import { parseParamFile, RUNTIME_PARAMS } from "@/lib/param-engine";
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
  isDefault: boolean;
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
type ClientSetRow = {
  id: string;
  client_name: string;
  serial: string;
  variant_id: string;
  client_id: string | null;
  drone_id: string | null;
  is_default: boolean;
};
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
      .select("id, client_name, serial, variant_id, client_id, drone_id, is_default")
      .in("variant_id", variantIds)
      .order("is_default", { ascending: false })
      .order("client_name")
      .order("serial");
    clientSets = data ?? [];
  }

  // Live lookups so renames in /admin/clients propagate.
  const clientIds = [...new Set(clientSets.map((c) => c.client_id).filter((id): id is string => !!id))];
  const droneIds = [...new Set(clientSets.map((c) => c.drone_id).filter((id): id is string => !!id))];
  const [{ data: liveClients }, { data: liveDrones }] = await Promise.all([
    clientIds.length ? supabase.from("clients").select("id, name").in("id", clientIds) : Promise.resolve({ data: [] }),
    droneIds.length ? supabase.from("drones").select("id, serial").in("id", droneIds) : Promise.resolve({ data: [] }),
  ]);
  const clientNameById = new Map((liveClients ?? []).map((c) => [c.id, c.name]));
  const droneSerialById = new Map((liveDrones ?? []).map((d) => [d.id, d.serial]));
  function liveLabel(c: ClientSetRow): string {
    const name = (c.client_id && clientNameById.get(c.client_id)) || c.client_name;
    const serial = (c.drone_id && droneSerialById.get(c.drone_id)) || c.serial;
    return serial ? `${name} · ${serial}` : name;
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
              name: liveLabel(c),
              isDefault: c.is_default,
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

  // PostgREST caps each response at 1000 rows; param_values can run over
  // 1000 per version, so paginate to avoid silently dropping params.
  async function fetchAllParamValues(ids: string[]) {
    const PAGE_SIZE = 1000;
    const out: { param_version_id: string; name: string; value: string }[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data: page } = await supabase
        .from("param_values")
        .select("param_version_id, name, value")
        .in("param_version_id", ids)
        .order("name")
        .range(from, from + PAGE_SIZE - 1);
      if (!page || page.length === 0) break;
      out.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return out;
  }

  const [{ data: versionsData }, paramValuesData] = await Promise.all([
    supabase
      .from("param_versions")
      .select("id, version_label, client_set_id, storage_path")
      .in("id", versionIds),
    fetchAllParamValues(versionIds),
  ]);

  const clientSetIds = [...new Set((versionsData ?? []).map((v) => v.client_set_id))];
  const { data: clientSetsData } = clientSetIds.length
    ? await supabase.from("client_sets").select("id, client_name, serial, variant_id, client_id, drone_id").in("id", clientSetIds)
    : { data: [] };

  // Live name/serial lookups
  const liveClientIds = [...new Set((clientSetsData ?? []).map((c) => c.client_id).filter((id): id is string => !!id))];
  const liveDroneIds = [...new Set((clientSetsData ?? []).map((c) => c.drone_id).filter((id): id is string => !!id))];
  const [{ data: liveClientsData2 }, { data: liveDronesData2 }] = await Promise.all([
    liveClientIds.length ? supabase.from("clients").select("id, name").in("id", liveClientIds) : Promise.resolve({ data: [] }),
    liveDroneIds.length ? supabase.from("drones").select("id, serial").in("id", liveDroneIds) : Promise.resolve({ data: [] }),
  ]);
  const clientNameById2 = new Map((liveClientsData2 ?? []).map((c) => [c.id, c.name]));
  const droneSerialById2 = new Map((liveDronesData2 ?? []).map((d) => [d.id, d.serial]));

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
    ? await supabase.from("families").select("id, slug, name").in("id", familyIds)
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
    let clientName = "?";
    if (clientSet) {
      const liveName = clientSet.client_id ? clientNameById2.get(clientSet.client_id) : undefined;
      const liveSerial = clientSet.drone_id ? droneSerialById2.get(clientSet.drone_id) : undefined;
      const name = liveName ?? clientSet.client_name;
      const serial = liveSerial ?? clientSet.serial;
      clientName = serial ? `${name} · ${serial}` : name;
    }
    return {
      id,
      label: v?.version_label ?? "?",
      clientName,
      variantName: variant?.name ?? "?",
      familyName: family?.name ?? "?",
      familySlug: (family as { slug?: string } | undefined)?.slug,
      variantId: clientSet?.variant_id,
      clientSetId: v?.client_set_id,
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

  const rows: CompareRow[] = Array.from(rowMap.entries())
    .filter(([name]) => !RUNTIME_PARAMS.has(name))
    .map(([name, values]) => ({ name, values }));

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
        <div className="flex items-center flex-wrap gap-x-1 gap-y-0.5 px-4 py-2 border-b border-border text-xs text-muted-foreground shrink-0 min-w-0">
          <Link href="/" className="text-primary hover:underline cursor-pointer shrink-0">Catalog</Link>
          <ChevronRight className="h-3 w-3 shrink-0" />
          {(() => {
            const dbV = versions.filter((v) => v.clientSetId && v.familySlug && v.variantId);
            const uniqueClientSets = new Set(dbV.map((v) => v.clientSetId));
            if (uniqueClientSets.size === 1 && dbV[0]?.familySlug && dbV[0]?.variantId && dbV[0]?.clientSetId) {
              const v = dbV[0];
              return (
                <>
                  <Link href={`/${v.familySlug}`} className="text-primary hover:underline cursor-pointer shrink-0">{v.familyName}</Link>
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <Link href={`/${v.familySlug}/${v.variantId}`} className="text-primary hover:underline cursor-pointer shrink-0">{v.variantName}</Link>
                  <ChevronRight className="h-3 w-3 shrink-0" />
                  <Link href={`/${v.familySlug}/${v.variantId}/${v.clientSetId}`} className="text-primary hover:underline cursor-pointer shrink-0">{v.clientName}</Link>
                  <ChevronRight className="h-3 w-3 shrink-0" />
                </>
              );
            }
            return (
              <>
                <Link href="/compare" className="text-primary hover:underline cursor-pointer shrink-0">Compare</Link>
                <ChevronRight className="h-3 w-3 shrink-0" />
              </>
            );
          })()}
          <span className="text-foreground shrink-0">{totalCount} version{totalCount !== 1 ? "s" : ""}</span>
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
      <div className="flex items-center flex-wrap gap-x-1 gap-y-0.5 px-4 py-2 border-b border-border text-xs text-muted-foreground shrink-0">
        <Link href="/" className="text-primary hover:underline cursor-pointer shrink-0">Catalog</Link>
        <ChevronRight className="h-3 w-3 shrink-0" />
        <span className="text-foreground shrink-0">Compare</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <VersionTree tree={tree} />
      </div>
    </div>
  );
}
