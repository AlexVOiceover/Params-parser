"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { FileUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDroneParams, DRONE_VERSION_ID } from "@/lib/drone-params-context";
import { CompareTable } from "@/components/compare/compare-table";
import { RUNTIME_PARAMS } from "@/lib/param-engine";
import { FILE_VERSION_ID, readCompareFile, clearCompareFile, type CompareFilePayload } from "@/lib/file-compare-shared";
import type { CompareVersion, CompareRow } from "@/lib/types";

interface Props {
  versions: CompareVersion[];
  rows: CompareRow[];
  hasDroneVersion: boolean;
  /** A transient .param file column, read from sessionStorage. */
  hasFileVersion?: boolean;
}

export function CompareTableWrapper({ versions, rows, hasDroneVersion, hasFileVersion = false }: Props) {
  const router = useRouter();
  const { droneParams } = useDroneParams();

  // Transient compare file (sessionStorage only — never uploaded).
  const [compareFile, setCompareFile] = useState<CompareFilePayload | null>(null);
  useEffect(() => {
    if (hasFileVersion) setCompareFile(readCompareFile());
  }, [hasFileVersion]);

  const handleRemoveFile = useCallback(() => {
    clearCompareFile();
    setCompareFile(null);
    const remaining = versions.map((v) => `v=${v.id}`);
    if (hasDroneVersion) remaining.push(`v=${DRONE_VERSION_ID}`);
    router.push(remaining.length ? `/compare?${remaining.join("&")}` : "/compare");
  }, [versions, hasDroneVersion, router]);

  const merged = useMemo(() => {
    const fileActive = hasFileVersion && compareFile;
    if (!fileActive && (!hasDroneVersion || !droneParams)) return { versions, rows };

    const showDrone = hasDroneVersion && !!droneParams;

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
      clientName: compareFile?.name ?? "File",
      variantName: "—",
      familyName: "Not saved",
    };

    const allVersions = [
      ...(showDrone ? [droneVersion] : []),
      ...(fileActive ? [fileVersion] : []),
      ...versions,
    ];
    const rowMap = new Map<string, Record<string, string>>();
    for (const row of rows) rowMap.set(row.name, { ...row.values });
    if (showDrone) {
      for (const { name, value } of droneParams) {
        if (!rowMap.has(name)) rowMap.set(name, {});
        rowMap.get(name)![DRONE_VERSION_ID] = value;
      }
    }
    if (fileActive) {
      for (const { name, value } of compareFile.params) {
        if (!rowMap.has(name)) rowMap.set(name, {});
        rowMap.get(name)![FILE_VERSION_ID] = value;
      }
    }

    // Only filter runtime/volatile params when comparing against catalog versions.
    // When viewing a single drone live, show all params including SCR_USER1/2.
    const filterRuntime = versions.length > 0;
    const allRows: CompareRow[] = Array.from(rowMap.entries())
      .filter(([name]) => !filterRuntime || !RUNTIME_PARAMS.has(name))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, values]) => ({ name, values }));

    return { versions: allVersions, rows: allRows };
  }, [hasDroneVersion, droneParams, hasFileVersion, compareFile, versions, rows]);

  if (hasDroneVersion && !droneParams) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-muted-foreground">
          No drone params loaded. Use &ldquo;Import from drone&rdquo; in the header first.
        </p>
      </div>
    );
  }

  // The compared file is session-scoped, so it is gone in a new tab or after
  // the session ends. Say so instead of rendering an empty column.
  if (hasFileVersion && !compareFile && versions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <p className="text-sm text-muted-foreground text-center">
          That compared file is no longer in this browser session. Pick it again with
          &ldquo;Compare with file…&rdquo; on the versions page.
        </p>
      </div>
    );
  }

  return (
    <>
      {hasFileVersion && compareFile && (
        <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-4 py-1.5 text-xs">
          <FileUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">
            Comparing against <span className="font-mono text-foreground">{compareFile.name}</span> — not saved to the catalog.
          </span>
          <button
            type="button"
            onClick={handleRemoveFile}
            className="ml-auto flex items-center gap-1 rounded border border-border px-2 py-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer whitespace-nowrap"
          >
            <X className="h-3 w-3" />
            Remove
          </button>
        </div>
      )}
      <CompareTable
        versions={merged.versions}
        rows={merged.rows}
        hasDroneVersion={hasDroneVersion}
      />
    </>
  );
}
