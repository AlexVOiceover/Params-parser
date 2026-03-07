import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { parseParamFile } from "@/lib/param-engine";
import { VersionTree } from "@/components/compare/version-tree";
import { CompareTable } from "@/components/compare/compare-table";

export const dynamic = "force-dynamic";

// ── Types ─────────────────────────────────────────────────────────────────────

interface VersionNode {
  id: string;
  label: string;
  isLatest: boolean;
}

interface ParamSetNode {
  id: string;
  name: string;
  versions: VersionNode[];
}

interface DroneNode {
  id: string;
  name: string;
  slug: string;
  paramSets: ParamSetNode[];
}

export interface CompareVersion {
  id: string;
  label: string;
  paramSetName: string;
  droneName: string;
}

export interface CompareRow {
  name: string;
  values: Record<string, string>;
}

// ── Selection branch: full hierarchy for version tree ─────────────────────────

type SetRow = { id: string; name: string; drone_type_id: string | null };
type VersionRow = { id: string; version_label: string; is_latest: boolean; param_set_id: string };

async function fetchTree(): Promise<DroneNode[]> {
  const supabase = createClient();

  const { data: drones } = await supabase
    .from("drone_types")
    .select("id, name, slug")
    .order("name");

  if (!drones?.length) return [];

  const droneIds = drones.map((d) => d.id);
  const { data: setsRaw } = await supabase
    .from("param_sets")
    .select("id, name, drone_type_id")
    .in("drone_type_id", droneIds)
    .not("drone_type_id", "is", null)
    .order("name");

  const sets: SetRow[] = setsRaw ?? [];
  const setIds = sets.map((s) => s.id);

  let versions: VersionRow[] = [];
  if (setIds.length) {
    const { data } = await supabase
      .from("param_versions")
      .select("id, version_label, is_latest, param_set_id")
      .in("param_set_id", setIds)
      .order("version_label");
    versions = data ?? [];
  }

  const setsByDrone = new Map<string, SetRow[]>();
  for (const s of sets) {
    if (!s.drone_type_id) continue;
    const arr = setsByDrone.get(s.drone_type_id) ?? [];
    arr.push(s);
    setsByDrone.set(s.drone_type_id, arr);
  }

  const versionsBySet = new Map<string, VersionRow[]>();
  for (const v of versions) {
    const arr = versionsBySet.get(v.param_set_id) ?? [];
    arr.push(v);
    versionsBySet.set(v.param_set_id, arr);
  }

  return drones
    .map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      paramSets: (setsByDrone.get(d.id) ?? [])
        .map((s) => ({
          id: s.id,
          name: s.name,
          versions: (versionsBySet.get(s.id) ?? []).map((v) => ({
            id: v.id,
            label: v.version_label,
            isLatest: v.is_latest,
          })),
        }))
        .filter((s) => s.versions.length > 0),
    }))
    .filter((d) => d.paramSets.length > 0);
}

// ── Compare branch: param values for selected versions ────────────────────────

async function fetchCompareData(
  versionIds: string[]
): Promise<{ versions: CompareVersion[]; rows: CompareRow[] }> {
  const supabase = createClient();
  const admin = createAdminClient();

  const [{ data: versionsData }, { data: paramValuesData }] = await Promise.all([
    supabase
      .from("param_versions")
      .select("id, version_label, param_set_id, storage_path")
      .in("id", versionIds),
    supabase
      .from("param_values")
      .select("param_version_id, name, value")
      .in("param_version_id", versionIds)
      .order("name"),
  ]);

  const paramSetIds = [...new Set((versionsData ?? []).map((v) => v.param_set_id))];
  const { data: setsData } = await supabase
    .from("param_sets")
    .select("id, name, drone_type_id")
    .in("id", paramSetIds);

  const droneTypeIds = [
    ...new Set(
      (setsData ?? []).map((s) => s.drone_type_id).filter((id): id is string => id !== null)
    ),
  ];
  const { data: dronesData } = droneTypeIds.length
    ? await supabase.from("drone_types").select("id, name").in("id", droneTypeIds)
    : { data: [] };

  const setMap = new Map((setsData ?? []).map((s) => [s.id, s]));
  const droneMap = new Map((dronesData ?? []).map((d) => [d.id, d]));
  const versionLookup = new Map((versionsData ?? []).map((v) => [v.id, v]));

  const versions: CompareVersion[] = versionIds.map((id) => {
    const v = versionLookup.get(id);
    const set = v ? setMap.get(v.param_set_id) : undefined;
    const drone = set?.drone_type_id ? droneMap.get(set.drone_type_id) : undefined;
    return {
      id,
      label: v?.version_label ?? "?",
      paramSetName: set?.name ?? "?",
      droneName: drone?.name ?? "?",
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
  const versionIds = Array.isArray(v) ? v : v ? [v] : [];

  if (versionIds.length >= 2) {
    const { versions, rows } = await fetchCompareData(versionIds);
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-1.5 px-6 py-3 border-b border-border text-xs text-muted-foreground shrink-0">
          <Link href="/catalog" className="hover:text-foreground transition-colors cursor-pointer">
            Catalog
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link
            href="/catalog/compare"
            className="hover:text-foreground transition-colors cursor-pointer"
          >
            Compare
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{versions.length} versions</span>
        </div>
        <div className="flex-1 overflow-hidden">
          <CompareTable versions={versions} rows={rows} />
        </div>
      </div>
    );
  }

  const tree = await fetchTree();
  return (
    <div className="h-full flex flex-col">
      <VersionTree tree={tree} />
    </div>
  );
}
