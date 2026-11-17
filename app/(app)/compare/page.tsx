import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ListChecks } from "lucide-react";
import { createClient, createAdminClient, createSessionClient } from "@/lib/supabase/server";
import { parseParamFile } from "@/lib/param-engine";
import { isRuntime } from "@/lib/desired-state";
import { ComparePicker } from "@/components/compare/version-picker";
import { getPickerHistories } from "@/lib/version-picker";
import { FILE_VERSION_ID } from "@/lib/file-compare-shared";
import { droneHref, modelHref } from "@/lib/versions";
import { buttonClass } from "@/components/ui/styles";
import { CompareTableWrapper } from "@/components/compare/compare-table-wrapper";
import { DRONE_VERSION_ID } from "@/lib/drone-params-shared";
import type { CompareVersion, CompareRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compare — AIR6",
};

// ── Compare branch: param values for selected versions ────────────────────────

interface BackLink { href: string; label: string }

async function fetchCompareData(
  versionIds: string[]
): Promise<{ versions: CompareVersion[]; rows: CompareRow[]; back: BackLink | null }> {
  const supabase = await createSessionClient().catch(() => createClient());
  const admin = createAdminClient();

  // Fetch param_values per version independently to avoid pagination boundary
  // issues that occur when using .in() across multiple large versions.
  async function fetchAllParamValues(ids: string[]) {
    const PAGE_SIZE = 500;
    const out: { param_version_id: string; name: string; value: string }[] = [];
    // Pages within one version are sequential, but versions are independent —
    // comparing several versions serially multiplied the wait by the count.
    const perVersion = await Promise.all(
      ids.map(async (id) => {
        const rows: { param_version_id: string; name: string; value: string }[] = [];
        for (let from = 0; ; from += PAGE_SIZE) {
          const { data: page } = await supabase
            .from("param_values")
            .select("name, value")
            .eq("param_version_id", id)
            .order("name")
            .range(from, from + PAGE_SIZE - 1);
          if (!page || page.length === 0) break;
          rows.push(...page.map((p) => ({ param_version_id: id, ...p })));
          if (page.length < PAGE_SIZE) break;
        }
        return rows;
      })
    );
    for (const rows of perVersion) out.push(...rows);
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
    ? await supabase.from("client_sets").select("id, client_name, serial, variant_id, client_id, drone_id, is_default").in("id", clientSetIds)
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
    .filter(([name]) => !isRuntime(name))
    .map(([name, values]) => ({ name, values }));

  // When everything compared belongs to one history, the way back is that drone or model.
  let back: BackLink | null = null;
  if (clientSetsData?.length === 1) {
    const set = clientSetsData[0];
    const variant = variantMap.get(set.variant_id);
    const family = variant?.family_id ? familyMap.get(variant.family_id) : undefined;
    const serial = (set.drone_id && droneSerialById2.get(set.drone_id)) || null;
    back = set.is_default || !serial
      ? { href: modelHref(set.variant_id), label: [family?.name, variant?.name].filter(Boolean).join(" · ") || "Model" }
      : { href: droneHref(serial), label: serial };
  }

  return { versions, rows, back };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string | string[]; pick?: string | string[] }>;
}) {
  const { v, pick } = await searchParams;
  const allIds = Array.isArray(v) ? v : v ? [v] : [];
  const picked = Array.isArray(pick) ? pick : pick ? [pick] : [];
  const hasDroneVersion = allIds.includes(DRONE_VERSION_ID);
  // A .param file lives in sessionStorage, so its column is merged client-side.
  const hasFileVersion = allIds.includes(FILE_VERSION_ID);
  const dbVersionIds = allIds.filter((id) => id !== DRONE_VERSION_ID && id !== FILE_VERSION_ID);

  if (dbVersionIds.length >= 1 || hasDroneVersion || hasFileVersion) {
    const { versions, rows, back } = dbVersionIds.length > 0
      ? await fetchCompareData(dbVersionIds)
      : { versions: [], rows: [], back: null };
    const totalCount = versions.length + (hasDroneVersion ? 1 : 0) + (hasFileVersion ? 1 : 0);
    const onlyOneHistory = back && !hasDroneVersion && !hasFileVersion ? back : null;
    return (
      <div className="h-full flex flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-card px-4 py-2 text-[13px]">
          <Link
            href={onlyOneHistory?.href ?? "/compare"}
            className="flex min-w-0 items-center gap-1 text-primary hover:underline cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{onlyOneHistory?.label ?? "Compare"}</span>
          </Link>
          <span className="font-medium text-foreground whitespace-nowrap">
            {totalCount === 1 ? "Viewing 1 version" : `Comparing ${totalCount} versions`}
          </span>
          <Link
            href={`/compare?${allIds.map((id) => `pick=${encodeURIComponent(id)}`).join("&")}`}
            className={buttonClass("secondary", "sm", "ml-auto")}
          >
            <ListChecks className="h-3.5 w-3.5" /> Add or change versions
          </Link>
        </div>
        <div className="flex-1 overflow-hidden">
          <CompareTableWrapper
            versions={versions}
            rows={rows}
            hasDroneVersion={hasDroneVersion}
            hasFileVersion={hasFileVersion}
          />
        </div>
      </div>
    );
  }

  const supabase = await createSessionClient().catch(() => createClient());
  const histories = await getPickerHistories(supabase);
  return <ComparePicker histories={histories} initial={picked} />;
}
