"use client";

import { useMemo } from "react";
import { useDroneParams, DRONE_VERSION_ID } from "@/lib/drone-params-context";
import { CompareTable } from "@/components/compare/compare-table";
import type { CompareVersion, CompareRow } from "@/app/catalog/compare/page";

interface Props {
  versions: CompareVersion[];
  rows: CompareRow[];
  hasDroneVersion: boolean;
}

export function CompareTableWrapper({ versions, rows, hasDroneVersion }: Props) {
  const { droneParams } = useDroneParams();
  console.log("[CompareWrapper] hasDroneVersion:", hasDroneVersion, "droneParams:", droneParams ? `${droneParams.length} params` : "null", "server versions:", versions.length, "server rows:", rows.length);

  const merged = useMemo(() => {
    if (!hasDroneVersion || !droneParams) return { versions, rows };

    const droneVersion: CompareVersion = {
      id: DRONE_VERSION_ID,
      label: "live",
      paramSetName: "Connected drone",
      droneName: "USB",
    };

    const allVersions = [droneVersion, ...versions];

    // Build map of drone params
    const droneMap = new Map(droneParams.map((p) => [p.name, p.value]));

    // Merge into existing rows + add drone-only params
    const rowMap = new Map<string, Record<string, string>>();
    for (const row of rows) {
      rowMap.set(row.name, { ...row.values });
    }
    for (const { name, value } of droneParams) {
      if (!rowMap.has(name)) rowMap.set(name, {});
      rowMap.get(name)![DRONE_VERSION_ID] = value;
    }

    const allRows: CompareRow[] = Array.from(rowMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, values]) => ({ name, values }));

    return { versions: allVersions, rows: allRows };
  }, [hasDroneVersion, droneParams, versions, rows]);

  if (hasDroneVersion && !droneParams) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">
          No drone params loaded. Use &ldquo;Import from drone&rdquo; in the header first.
        </p>
      </div>
    );
  }

  return <CompareTable versions={merged.versions} rows={merged.rows} />;
}
