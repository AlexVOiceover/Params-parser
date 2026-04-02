"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { SlidersHorizontal, Info } from "lucide-react";
import { validateParam } from "@/lib/param-engine";
import type { CompareVersion, CompareRow } from "@/app/catalog/compare/page";
import type { ParamDefinition } from "@/lib/types";

interface Props {
  versions: CompareVersion[];
  rows: CompareRow[];
}

const PARAM_COL_DEFAULT = 200;
const VERSION_COL_DEFAULT = 160;
const COL_MIN = 60;

export function CompareTable({ versions, rows }: Props) {
  const [showDiffsOnly, setShowDiffsOnly] = useState(false);
  const [paramDefs, setParamDefs] = useState<Record<string, ParamDefinition> | null>(null);
  const [expandedParam, setExpandedParam] = useState<string | null>(null);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  // column widths: index 0 = param name col, 1..n = version cols
  const [colWidths, setColWidths] = useState<number[]>(() => [
    PARAM_COL_DEFAULT,
    ...versions.map(() => VERSION_COL_DEFAULT),
  ]);

  const dragState = useRef<{ colIndex: number; startX: number; startWidth: number } | null>(null);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.current) return;
    const { colIndex, startX, startWidth } = dragState.current;
    const delta = e.clientX - startX;
    const newWidth = Math.max(COL_MIN, startWidth + delta);
    setColWidths((prev) => {
      const next = [...prev];
      next[colIndex] = newWidth;
      return next;
    });
  }, []);

  const onMouseUp = useCallback(() => {
    dragState.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  function startResize(e: React.MouseEvent, colIndex: number) {
    e.preventDefault();
    dragState.current = { colIndex, startX: e.clientX, startWidth: colWidths[colIndex] };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  useEffect(() => {
    fetch("/api/param-definitions")
      .then((r) => r.json())
      .then((d) => {
        if (d.params) setParamDefs(d.params as Record<string, ParamDefinition>);
      })
      .catch(() => {});
  }, []);

  function copyValue(value: string, cellKey: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedCell(cellKey);
      setTimeout(() => setCopiedCell((c) => (c === cellKey ? null : c)), 1200);
    });
  }

  const versionIds = versions.map((v) => v.id);

  const processedRows = rows.map((row) => {
    const presentValues = versionIds.map((id) => row.values[id]).filter((v) => v !== undefined);
    const isDiff = presentValues.length > 0 && new Set(presentValues).size > 1;
    return { ...row, isDiff };
  });

  const visibleRows = showDiffsOnly ? processedRows.filter((r) => r.isDiff) : processedRows;
  const diffCount = processedRows.filter((r) => r.isDiff).length;

  function ResizeHandle({ colIndex }: { colIndex: number }) {
    return (
      <div
        onMouseDown={(e) => startResize(e, colIndex)}
        className="absolute right-0 top-0 h-full w-4 flex items-center justify-center group/handle cursor-col-resize z-10"
      >
        <div className="w-px h-4/5 bg-border group-hover/handle:bg-primary group-hover/handle:w-0.5 transition-all" />
      </div>
    );
  }

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
        <table
          className="border-collapse"
          style={{ tableLayout: "fixed", width: colWidths.reduce((a, b) => a + b, 0) }}
        >
          <colgroup>
            {colWidths.map((w, i) => (
              <col key={i} style={{ width: w }} />
            ))}
          </colgroup>
          <thead className="sticky top-0 z-30">
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="sticky left-0 z-20 bg-secondary px-4 py-2.5 text-left font-medium border-r border-border overflow-hidden" style={{ width: colWidths[0] }}>
                Param
                <ResizeHandle colIndex={0} />
              </th>
              {versions.map((v, i) => (
                <th
                  key={v.id}
                  className="relative px-4 py-2.5 text-left font-medium bg-secondary overflow-hidden"
                >
                  <div className="text-foreground font-semibold truncate text-sm">{v.paramSetName}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-muted-foreground text-[10px] truncate">{v.droneName}</span>
                    <span className="rounded bg-primary/20 border border-primary/40 px-1.5 py-px font-mono text-[10px] font-bold text-primary shrink-0">v{v.label}</span>
                  </div>
                  <ResizeHandle colIndex={i + 1} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => {
              const def = paramDefs?.[row.name];
              const isExpanded = expandedParam === row.name;
              const isLast = i === visibleRows.length - 1;

              return (
                <React.Fragment key={row.name}>
                  <tr className={!isExpanded && !isLast ? "border-b border-border" : ""}>
                    {/* Frozen param name column */}
                    <td className="sticky left-0 z-10 bg-card border-r border-border overflow-hidden" style={{ maxWidth: 0 }}>
                      <div className="flex items-center gap-1 px-4 py-2 group/name">
                        {row.isDiff && (
                          <span className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle shrink-0" />
                        )}
                        <span
                          onClick={() => copyValue(row.name, `name:${row.name}`)}
                          title="Click to copy"
                          className="font-mono text-xs text-foreground cursor-pointer hover:text-primary transition-colors truncate min-w-0"
                        >
                          {copiedCell === `name:${row.name}` ? (
                            <span className="text-emerald-400">copied!</span>
                          ) : (
                            row.name
                          )}
                        </span>
                        <button
                          onClick={() => setExpandedParam(isExpanded ? null : row.name)}
                          className={`ml-1 shrink-0 transition-colors cursor-pointer opacity-0 group-hover/name:opacity-100 ${
                            isExpanded ? "opacity-100 text-primary" : "text-muted-foreground hover:text-foreground"
                          }`}
                          title="Show description"
                        >
                          <Info className="h-3 w-3" />
                        </button>
                      </div>
                    </td>

                    {/* Value cells */}
                    {versionIds.map((vid) => {
                      const value = row.values[vid];
                      const isMissing = value === undefined;
                      const isInvalid = !isMissing && def ? validateParam(value, def) !== null : false;
                      const isDiffCell = row.isDiff && !isMissing;
                      const cellKey = `${row.name}:${vid}`;
                      const copied = copiedCell === cellKey;

                      let cellClass = "px-4 py-2 font-mono text-xs overflow-hidden whitespace-nowrap transition-colors max-w-0 ";
                      if (copied) {
                        cellClass += "bg-emerald-500/20 text-emerald-300";
                      } else if (isInvalid) {
                        cellClass += "bg-destructive/20 text-destructive-foreground";
                      } else if (isDiffCell) {
                        cellClass += "bg-amber-400/15 text-amber-200";
                      } else if (isMissing) {
                        cellClass += "text-muted-foreground italic";
                      } else {
                        cellClass += "text-foreground";
                      }

                      return (
                        <td
                          key={vid}
                          className={cellClass + (!isMissing ? " cursor-pointer hover:brightness-125" : "")}
                          onClick={() => !isMissing && copyValue(value, cellKey)}
                          title={!isMissing ? "Click to copy" : undefined}
                        >
                          {copied ? "copied!" : isMissing ? "—" : value}
                        </td>
                      );
                    })}
                  </tr>

                  {isExpanded && (
                    <tr className={!isLast ? "border-b border-border" : ""}>
                      <td
                        colSpan={versionIds.length + 1}
                        className="px-6 py-3 bg-secondary/30 border-t border-border/50"
                      >
                        {!def ? (
                          <p className="text-xs text-muted-foreground italic">No definition available.</p>
                        ) : (
                          <div className="flex flex-wrap gap-x-8 gap-y-2">
                            {def.DisplayName && def.DisplayName !== row.name && (
                              <p className="text-xs text-foreground font-medium w-full">{def.DisplayName}</p>
                            )}
                            {def.Description && (
                              <p className="text-xs text-muted-foreground leading-relaxed w-full">{def.Description}</p>
                            )}
                            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs mt-0.5">
                              {def.Units && (
                                <span className="text-muted-foreground">Units: <span className="text-foreground font-mono">{def.Units}</span></span>
                              )}
                              {def.Default !== undefined && (
                                <span className="text-muted-foreground">Default: <span className="text-foreground font-mono">{def.Default}</span></span>
                              )}
                              {def.Range && (
                                <span className="text-muted-foreground">Range: <span className="text-foreground font-mono">{def.Range.low} – {def.Range.high}</span></span>
                              )}
                              {def.RebootRequired === "True" && (
                                <span className="text-amber-400">Reboot required</span>
                              )}
                            </div>
                            {def.Values && Object.keys(def.Values).length > 0 && (
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                                {Object.entries(def.Values).map(([k, v]) => (
                                  <span key={k} className="text-muted-foreground">
                                    <span className="font-mono text-primary">{k}</span> = {v}
                                  </span>
                                ))}
                              </div>
                            )}
                            {def.Bitmask && Object.keys(def.Bitmask).length > 0 && (
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                                {Object.entries(def.Bitmask).map(([k, v]) => (
                                  <span key={k} className="text-muted-foreground">
                                    <span className="font-mono text-primary">bit {k}</span> = {v}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
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
