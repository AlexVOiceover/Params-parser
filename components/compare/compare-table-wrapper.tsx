"use client";

import { useMemo, useState, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useDroneParams, DRONE_VERSION_ID } from "@/lib/drone-params-context";
import { clearDroneMatchCache } from "@/lib/use-connected-drone-match";
import { CompareTable } from "@/components/compare/compare-table";
import { WriteDroneDialog, type WriteChange } from "@/components/write-drone-dialog";
import { RUNTIME_PARAMS, LOCKED_PARAMS } from "@/lib/param-engine";
import type { CompareVersion, CompareRow } from "@/lib/types";
import type { ParamWriteResult } from "@/lib/mavlink-serial";

interface Props {
  versions: CompareVersion[];
  rows: CompareRow[];
  hasDroneVersion: boolean;
}

export function CompareTableWrapper({ versions, rows, hasDroneVersion }: Props) {
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
      .filter(([name]) => !filterRuntime || !RUNTIME_PARAMS.has(name))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, values]) => ({ name, values }));

    return { versions: allVersions, rows: allRows };
  }, [hasDroneVersion, droneParams, versions, rows]);

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

  return (
    <>
      {saveError && (
        <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {saveError}
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
