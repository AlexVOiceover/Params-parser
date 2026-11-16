"use client";

import { useMemo } from "react";
import { useDroneParams, DRONE_VERSION_ID } from "@/lib/drone-params-context";
import { CompareTable } from "@/components/compare/compare-table";
import { isRuntime } from "@/lib/desired-state";
import type { CompareVersion, CompareRow } from "@/lib/types";

interface Props {
  versions: CompareVersion[];
  rows: CompareRow[];
  hasDroneVersion: boolean;
}

export function CompareTableWrapper({ versions, rows, hasDroneVersion }: Props) {
  const { droneParams } = useDroneParams();

  const merged = useMemo(() => {
    if (!hasDroneVersion || !droneParams) return { versions, rows };

    const droneVersion: CompareVersion = {
      id: DRONE_VERSION_ID,
      label: "live",
      clientName: "Connected drone",
      variantName: "—",
      familyName: "USB",
    };

    const allVersions = [droneVersion, ...versions];
    const rowMap = new Map<string, Record<string, string>>();
    for (const row of rows) rowMap.set(row.name, { ...row.values });
    for (const { name, value } of droneParams) {
      if (!rowMap.has(name)) rowMap.set(name, {});
      rowMap.get(name)![DRONE_VERSION_ID] = value;
    }

    // Only filter runtime/volatile params when comparing against catalog versions.
    // When viewing a single drone live, show all params including SCR_USER1/2.
    const filterRuntime = versions.length > 0;
    const allRows: CompareRow[] = Array.from(rowMap.entries())
      .filter(([name]) => !filterRuntime || !isRuntime(name))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, values]) => ({ name, values }));

    return { versions: allVersions, rows: allRows };
  }, [hasDroneVersion, droneParams, versions, rows]);

  if (hasDroneVersion && !droneParams) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">
          No drone read yet. Use &ldquo;Connect drone&rdquo; in the header first.
        </p>
      </div>
    );
  }

  return (
    <>
      <CompareTable
        versions={merged.versions}
        rows={merged.rows}
        hasDroneVersion={hasDroneVersion}
      />
    </>
  );
}
