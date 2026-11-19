"use client";

import { useEffect, useMemo, useState } from "react";
import { useDroneParams, DRONE_VERSION_ID } from "@/lib/drone-params-context";
import { CompareTable } from "@/components/compare/compare-table";
import { isRuntime } from "@/lib/desired-state";
import { FILE_VERSION_ID, readCompareFile, type CompareFilePayload } from "@/lib/file-compare-shared";
import type { CompareVersion, CompareRow } from "@/lib/types";

interface Props {
  versions: CompareVersion[];
  rows: CompareRow[];
  hasDroneVersion: boolean;
  /** A .param file column, read from this tab's sessionStorage. */
  hasFileVersion: boolean;
}

export function CompareTableWrapper({ versions, rows, hasDroneVersion, hasFileVersion }: Props) {
  const { droneParams } = useDroneParams();
  const [file, setFile] = useState<CompareFilePayload | null>(null);
  useEffect(() => { if (hasFileVersion) setFile(readCompareFile()); }, [hasFileVersion]);

  const merged = useMemo(() => {
    const showDrone = hasDroneVersion && !!droneParams;
    const showFile = hasFileVersion && !!file;
    if (!showDrone && !showFile) return { versions, rows };

    const droneVersion: CompareVersion = {
      id: DRONE_VERSION_ID,
      label: "live",
      clientName: "Connected drone",
      variantName: "—",
      familyName: "USB",
    };

    const fileVersion: CompareVersion = {
      id: FILE_VERSION_ID,
      label: "file",
      clientName: file?.name ?? "File",
      variantName: "—",
      familyName: "Not saved",
    };

    const allVersions = [...(showDrone ? [droneVersion] : []), ...(showFile ? [fileVersion] : []), ...versions];
    const rowMap = new Map<string, Record<string, string>>();
    for (const row of rows) rowMap.set(row.name, { ...row.values });
    for (const { name, value } of showDrone ? droneParams : []) {
      if (!rowMap.has(name)) rowMap.set(name, {});
      rowMap.get(name)![DRONE_VERSION_ID] = value;
    }
    for (const { name, value } of showFile ? file.params : []) {
      if (!rowMap.has(name)) rowMap.set(name, {});
      rowMap.get(name)![FILE_VERSION_ID] = value;
    }

    // Only filter runtime/volatile params when comparing against catalog versions.
    // When viewing a single drone live, show all params including SCR_USER1/2.
    const filterRuntime = versions.length > 0;
    const allRows: CompareRow[] = Array.from(rowMap.entries())
      .filter(([name]) => !filterRuntime || !isRuntime(name))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, values]) => ({ name, values }));

    return { versions: allVersions, rows: allRows };
  }, [hasDroneVersion, droneParams, hasFileVersion, file, versions, rows]);

  if (hasDroneVersion && !droneParams) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">
          No drone read yet. Use &ldquo;Connect drone&rdquo; in the header first.
        </p>
      </div>
    );
  }

  // The file lives in this tab's session only; say so instead of an empty column.
  if (hasFileVersion && !file && versions.length === 0 && !hasDroneVersion) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <p className="text-sm text-muted-foreground text-center">
          That file is no longer in this browser tab. Add it again from Compare.
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
