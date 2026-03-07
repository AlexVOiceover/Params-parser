"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { validateParam } from "@/lib/param-engine";
import type { CompareVersion, CompareRow } from "@/app/catalog/compare/page";
import type { ParamDefinition } from "@/lib/types";

interface Props {
  versions: CompareVersion[];
  rows: CompareRow[];
}

export function CompareTable({ versions, rows }: Props) {
  const [showDiffsOnly, setShowDiffsOnly] = useState(false);
  const [paramDefs, setParamDefs] = useState<Record<string, ParamDefinition> | null>(null);

  useEffect(() => {
    fetch("/api/param-definitions")
      .then((r) => r.json())
      .then((d) => {
        if (d.params) setParamDefs(d.params as Record<string, ParamDefinition>);
      })
      .catch(() => {});
  }, []);

  const versionIds = versions.map((v) => v.id);

  const processedRows = rows.map((row) => {
    const presentValues = versionIds.map((id) => row.values[id]).filter((v) => v !== undefined);
    const isDiff = presentValues.length > 0 && new Set(presentValues).size > 1;
    return { ...row, isDiff };
  });

  const visibleRows = showDiffsOnly ? processedRows.filter((r) => r.isDiff) : processedRows;
  const diffCount = processedRows.filter((r) => r.isDiff).length;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-toolbar shrink-0">
        <span className="text-xs text-muted-foreground">
          <span className="text-amber-400 font-medium">{diffCount}</span>
          {" param"}
          {diffCount !== 1 ? "s" : ""} differ · {rows.length} total
        </span>
        <div className="flex-1" />
        <button
          onClick={() => setShowDiffsOnly((v) => !v)}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            showDiffsOnly
              ? "border-amber-400/50 bg-amber-400/10 text-amber-300"
              : "border-border text-foreground hover:bg-secondary"
          }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {showDiffsOnly ? "Differences only" : "Show differences only"}
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse" style={{ width: "max-content", minWidth: "100%" }}>
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="sticky left-0 z-20 bg-secondary px-4 py-2.5 text-left font-medium border-r border-border min-w-[220px]">
                Param
              </th>
              {versions.map((v) => (
                <th
                  key={v.id}
                  className="px-4 py-2.5 text-left font-medium whitespace-nowrap min-w-[180px] bg-secondary"
                >
                  <div className="text-foreground font-medium">{v.droneName}</div>
                  <div className="text-muted-foreground font-normal">
                    {v.paramSetName} · v{v.label}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => {
              const def = paramDefs?.[row.name];
              return (
                <tr
                  key={row.name}
                  className={i !== visibleRows.length - 1 ? "border-b border-border" : ""}
                >
                  {/* Frozen param name column */}
                  <td className="sticky left-0 z-10 bg-card px-4 py-2 font-mono text-xs text-foreground border-r border-border whitespace-nowrap">
                    {row.isDiff && (
                      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle shrink-0" />
                    )}
                    {row.name}
                  </td>

                  {/* Value cells */}
                  {versionIds.map((vid) => {
                    const value = row.values[vid];
                    const isMissing = value === undefined;
                    const isInvalid =
                      !isMissing && def ? validateParam(value, def) !== null : false;
                    const isDiffCell = row.isDiff && !isMissing;

                    let cellClass = "px-4 py-2 font-mono text-xs whitespace-nowrap ";
                    if (isInvalid) {
                      cellClass += "bg-destructive/20 text-destructive-foreground";
                    } else if (isDiffCell) {
                      cellClass += "bg-amber-400/15 text-amber-200";
                    } else if (isMissing) {
                      cellClass += "text-muted-foreground italic";
                    } else {
                      cellClass += "text-foreground";
                    }

                    return (
                      <td key={vid} className={cellClass}>
                        {isMissing ? "—" : value}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={versions.length + 1}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  {showDiffsOnly
                    ? "All params are identical across selected versions."
                    : "No params found."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
