import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const versionIds = searchParams.getAll("v");

  if (versionIds.length < 2) {
    return NextResponse.json({ error: "At least 2 version IDs required" }, { status: 400 });
  }

  const supabase = createClient();

  const [{ data: versionsData }, { data: paramValuesData }] = await Promise.all([
    supabase
      .from("param_versions")
      .select("id, version_label, param_set_id")
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
  const { data: dronesData } = await supabase
    .from("drone_types")
    .select("id, name")
    .in("id", droneTypeIds);

  const setMap = new Map((setsData ?? []).map((s) => [s.id, s]));
  const droneMap = new Map((dronesData ?? []).map((d) => [d.id, d]));
  const versionLookup = new Map((versionsData ?? []).map((v) => [v.id, v]));

  const versions = versionIds.map((id) => {
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

  const rowMap = new Map<string, Record<string, string>>();
  for (const pv of paramValuesData ?? []) {
    if (!rowMap.has(pv.name)) rowMap.set(pv.name, {});
    rowMap.get(pv.name)![pv.param_version_id] = pv.value;
  }
  const rows = Array.from(rowMap.entries()).map(([name, values]) => ({ name, values }));

  return NextResponse.json({ versions, rows });
}
