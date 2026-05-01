"use client";

import { useMemo, useState, useCallback } from "react";
import { useDroneParams, DRONE_VERSION_ID } from "@/lib/drone-params-context";
import { CompareTable } from "@/components/compare/compare-table";
import { WriteDroneDialog, type WriteChange } from "@/components/write-drone-dialog";
import type { CompareVersion, CompareRow } from "@/lib/types";
import type { ParamWriteResult } from "@/lib/mavlink-serial";

interface Props {
  versions: CompareVersion[];
  rows: CompareRow[];
  hasDroneVersion: boolean;
}

export function CompareTableWrapper({ versions, rows, hasDroneVersion }: Props) {
  const { droneParams, setDroneParams } = useDroneParams();
  const [writeMode, setWriteMode] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<Map<string, number>>(new Map());
  const [writeDialogOpen, setWriteDialogOpen] = useState(false);

  const merged = useMemo(() => {
    if (!hasDroneVersion || !droneParams) return { versions, rows };

    const droneVersion: CompareVersion = {
      id: DRONE_VERSION_ID,
      label: "live",
      variantName: "Connected drone",
      familyName: "USB",
    };

    const allVersions = [droneVersion, ...versions];
    const rowMap = new Map<string, Record<string, string>>();
    for (const row of rows) rowMap.set(row.name, { ...row.values });
    for (const { name, value } of droneParams) {
      if (!rowMap.has(name)) rowMap.set(name, {});
      rowMap.get(name)![DRONE_VERSION_ID] = value;
    }

    const allRows: CompareRow[] = Array.from(rowMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, values]) => ({ name, values }));

    return { versions: allVersions, rows: allRows };
  }, [hasDroneVersion, droneParams, versions, rows]);

  const handleEditParam = useCallback((name: string, value: number) => {
    setPendingEdits((prev) => {
      const next = new Map(prev);
      // If the edit equals the current live value, drop it (no-op edit)
      const current = droneParams?.find((p) => p.name === name)?.value;
      if (current !== undefined && parseFloat(current) === value) {
        next.delete(name);
      } else {
        next.set(name, value);
      }
      return next;
    });
  }, [droneParams]);

  const handleClearEdit = useCallback((name: string) => {
    setPendingEdits((prev) => {
      const next = new Map(prev);
      next.delete(name);
      return next;
    });
  }, []);

  const handleClearAllEdits = useCallback(() => {
    setPendingEdits(new Map());
  }, []);

  const handleToggleWriteMode = useCallback(() => {
    setWriteMode((prev) => {
      if (prev) setPendingEdits(new Map());
      return !prev;
    });
  }, []);

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

  const writeChanges: WriteChange[] = useMemo(
    () => Array.from(pendingEdits.entries()).map(([name, value]) => ({ name, value })),
    [pendingEdits]
  );

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
      <CompareTable
        versions={merged.versions}
        rows={merged.rows}
        writableVersionId={hasDroneVersion ? DRONE_VERSION_ID : undefined}
        writeMode={writeMode}
        pendingEdits={pendingEdits}
        onToggleWriteMode={handleToggleWriteMode}
        onEditParam={handleEditParam}
        onClearEdit={handleClearEdit}
        onClearAllEdits={handleClearAllEdits}
        onWriteToDrone={handleWriteToDrone}
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
