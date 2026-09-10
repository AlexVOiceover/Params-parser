"use client";

import { useMemo, useState, useCallback, useTransition, useEffect } from "react";
import { FileUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDroneParams, DRONE_VERSION_ID } from "@/lib/drone-params-context";
import { clearDroneMatchCache } from "@/lib/use-connected-drone-match";
import { CompareTable } from "@/components/compare/compare-table";
import { WriteDroneDialog, type WriteChange } from "@/components/write-drone-dialog";
import { RUNTIME_PARAMS, LOCKED_PARAMS } from "@/lib/param-engine";
import { FILE_VERSION_ID, readCompareFile, clearCompareFile, type CompareFilePayload } from "@/lib/file-compare-shared";
import type { CompareVersion, CompareRow } from "@/lib/types";
import type { ParamWriteResult } from "@/lib/mavlink-serial";

interface Props {
  versions: CompareVersion[];
  rows: CompareRow[];
  hasDroneVersion: boolean;
  /** A transient .param file column, read from sessionStorage. */
  hasFileVersion?: boolean;
}

export function CompareTableWrapper({ versions, rows, hasDroneVersion, hasFileVersion = false }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { droneParams, setDroneParams } = useDroneParams();
  const [writeMode, setWriteMode] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Map<string, number>>(new Map());
  const [writeDialogOpen, setWriteDialogOpen] = useState(false);

  // Which version id is currently editable.
  // Drone column: DRONE_VERSION_ID (write to physical drone via MAVLink).
  // Catalog column: the version's DB id (save edits to DB + storage).
  const [writableVersionId, setWritableVersionId] = useState<string | undefined>(undefined);
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

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

  const handleEditParam = useCallback((name: string, value: number) => {
    if (LOCKED_PARAMS.has(name)) return; // silently reject edits to locked params
    setPendingEdits((prev) => {
      const next = new Map(prev);
      if (writableVersionId === DRONE_VERSION_ID) {
        // For drone edits: drop if unchanged
        const current = droneParams?.find((p) => p.name === name)?.value;
        if (current !== undefined && parseFloat(current) === value) {
          next.delete(name);
          return next;
        }
      }
      next.set(name, value);
      return next;
    });
  }, [droneParams, writableVersionId]);

  const handleClearEdit = useCallback((name: string) => {
    setPendingEdits((prev) => { const next = new Map(prev); next.delete(name); return next; });
  }, []);

  const handleClearAllEdits = useCallback(() => setPendingEdits(new Map()), []);

  const handleToggleWriteMode = useCallback((versionId: string) => {
    // The transient file column has no DB row behind it — never editable.
    if (versionId === FILE_VERSION_ID) return;
    setWriteMode((prev) => {
      const turningOff = prev && writableVersionId === versionId;
      if (turningOff) {
        setPendingEdits(new Map());
        setWritableVersionId(undefined);
        setSaveError(null);
        return false;
      }
      setPendingEdits(new Map());
      setWritableVersionId(versionId);
      setSaveError(null);
      return true;
    });
  }, [writableVersionId]);

  // Drone write path
  const handleWriteToDrone = useCallback(() => {
    if (pendingEdits.size === 0) return;
    setWriteDialogOpen(true);
  }, [pendingEdits.size]);

  const handleWriteSuccess = useCallback(
    (written: ParamWriteResult[]) => {
      if (!droneParams) return;
      const writtenMap = new Map(written.map((r) => [r.name, r.actual ?? r.requested]));
      const updated = droneParams.map((p) => {
        const v = writtenMap.get(p.name);
        return v !== undefined ? { ...p, value: String(v) } : p;
      });
      setDroneParams(updated);
      setPendingEdits((prev) => {
        const next = new Map(prev);
        for (const r of written) if (r.success) next.delete(r.name);
        return next;
      });
    },
    [droneParams, setDroneParams]
  );

  // Catalog save path
  const handleSaveCatalog = useCallback(async () => {
    if (!writableVersionId || writableVersionId === DRONE_VERSION_ID) return;
    if (pendingEdits.size === 0) return;
    setSavingCatalog(true);
    setSaveError(null);
    const edits: Record<string, number> = {};
    pendingEdits.forEach((v, k) => { edits[k] = v; });
    const res = await fetch(`/api/admin/param-versions/${writableVersionId}/values`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ edits }),
    });
    setSavingCatalog(false);
    if (res.ok) {
      setPendingEdits(new Map());
      setWriteMode(false);
      setWritableVersionId(undefined);
      clearDroneMatchCache();
      startTransition(() => router.refresh());
    } else {
      const body = await res.json().catch(() => ({}));
      setSaveError(body?.error ?? "Save failed");
    }
  }, [writableVersionId, pendingEdits]);

  const writeChanges: WriteChange[] = useMemo(
    () => Array.from(pendingEdits.entries()).map(([name, value]) => ({ name, value })),
    [pendingEdits]
  );

  const isCatalogEditMode = writeMode && writableVersionId && writableVersionId !== DRONE_VERSION_ID;

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
      {saveError && (
        <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {saveError}
        </div>
      )}
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
        writableVersionId={writableVersionId}
        writeMode={writeMode}
        pendingEdits={pendingEdits}
        onToggleWriteMode={handleToggleWriteMode}
        onEditParam={handleEditParam}
        onClearEdit={handleClearEdit}
        onClearAllEdits={handleClearAllEdits}
        onWriteToDrone={writableVersionId === DRONE_VERSION_ID ? handleWriteToDrone : undefined}
        onSaveCatalog={isCatalogEditMode ? handleSaveCatalog : undefined}
        savingCatalog={savingCatalog}
        hasDroneVersion={hasDroneVersion}
      />
      {writeDialogOpen && (
        <WriteDroneDialog
          changes={writeChanges}
          onClose={() => setWriteDialogOpen(false)}
          onSuccess={handleWriteSuccess}
        />
      )}
    </>
  );
}
