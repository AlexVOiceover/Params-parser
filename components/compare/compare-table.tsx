"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { SlidersHorizontal, Info, Upload, X, RotateCcw, Search, GitCompareArrows, FileDown, Copy, Check } from "lucide-react";
import { validateParam, paramValuesEqual, LOCKED_PARAMS } from "@/lib/param-engine";
import type { CompareVersion, CompareRow, ParamDefinition } from "@/lib/types";

interface Props {
  versions: CompareVersion[];
  rows: CompareRow[];
  writableVersionId?: string;
  writeMode?: boolean;
  pendingEdits?: Map<string, number>;
  /** Called with the version id to toggle edit mode on that column. */
  onToggleWriteMode?: (versionId: string) => void;
  onEditParam?: (name: string, value: number) => void;
  onClearEdit?: (name: string) => void;
  onClearAllEdits?: () => void;
  /** Present only when the writable column is the connected drone. */
  onWriteToDrone?: () => void;
  /** Present only when the writable column is a catalog version. */
  onSaveCatalog?: () => void;
  savingCatalog?: boolean;
  hasDroneVersion?: boolean;
}

const PARAM_COL_DEFAULT = 200;
const VERSION_COL_DEFAULT = 100;
const COL_MIN = 60;

export function CompareTable({
  versions,
  rows,
  writableVersionId,
  writeMode = false,
  pendingEdits,
  onToggleWriteMode,
  onEditParam,
  onClearEdit,
  onClearAllEdits,
  onWriteToDrone,
  onSaveCatalog,
  savingCatalog = false,
  hasDroneVersion = false,
}: Props) {
  const [showDiffsOnly, setShowDiffsOnly] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvCopied, setCsvCopied] = useState(false);
  const [paramDefs, setParamDefs] = useState<Record<string, ParamDefinition> | null>(null);
  const [editingCell, setEditingCell] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [expandedParam, setExpandedParam] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"name" | "value" | "both">("name");
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);
  // Reset "modified only" filter when write mode exits
  const prevWriteMode = React.useRef(writeMode);
  if (prevWriteMode.current !== writeMode) {
    prevWriteMode.current = writeMode;
    if (!writeMode && showModifiedOnly) setShowModifiedOnly(false);
  }

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

  const versionIds = versions.map((v) => v.id);

  const processedRows = rows.map((row) => {
    const vals = versionIds.map((id) => row.values[id]);
    // A row is a diff if any two non-missing values differ (with float tolerance)
    // or if some versions have the value and others don't.
    let isDiff = false;
    for (let i = 1; i < vals.length; i++) {
      const a = vals[0];
      const b = vals[i];
      if (a === undefined && b === undefined) continue;
      if (a === undefined || b === undefined) { isDiff = true; break; }
      if (!paramValuesEqual(a, b)) { isDiff = true; break; }
    }
    return { ...row, isDiff };
  });

  const canDiff = versions.length >= 2;
  const diffCount = processedRows.filter((r) => r.isDiff).length;

  const trimmedQuery = searchQuery.trim();
  const queryLower = trimmedQuery.toLowerCase();
  const queryAsNumber = trimmedQuery === "" ? NaN : Number(trimmedQuery);
  const queryIsNumber = !Number.isNaN(queryAsNumber);

  function valueMatches(value: string): boolean {
    if (!trimmedQuery) return false;
    if (value === trimmedQuery) return true;
    if (queryIsNumber) {
      const v = Number(value);
      if (!Number.isNaN(v) && v === queryAsNumber) return true;
    }
    return false;
  }

  function rowMatchesSearch(row: typeof processedRows[number]): boolean {
    if (!trimmedQuery) return true;
    const nameMatch = row.name.toLowerCase().includes(queryLower);
    const valueMatch = Object.values(row.values).some(valueMatches);
    if (searchMode === "name") return nameMatch;
    if (searchMode === "value") return valueMatch;
    return nameMatch || valueMatch;
  }

  let visibleRows = showDiffsOnly && canDiff ? processedRows.filter((r) => r.isDiff) : processedRows;
  if (showModifiedOnly && pendingEdits && pendingEdits.size > 0) {
    visibleRows = visibleRows.filter((r) => pendingEdits.has(r.name));
  }
  if (trimmedQuery) visibleRows = visibleRows.filter(rowMatchesSearch);

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
    <>
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-col border-b border-border bg-toolbar shrink-0">
        <div className="flex items-center gap-2 px-4 py-2">
          {/* Stats — hidden on very small screens to save space */}
          <span className="hidden sm:block text-xs text-muted-foreground shrink-0">
            {canDiff ? (
              <>
                <span className="text-amber-600 dark:text-amber-400 font-medium">{diffCount}</span>
                {" param"}{diffCount !== 1 ? "s" : ""} differ · {rows.length} total
              </>
            ) : (
              <>{rows.length} total</>
            )}
            {trimmedQuery && <span className="ml-2 text-primary font-medium">· {visibleRows.length} match{visibleRows.length === 1 ? "" : "es"}</span>}
            {writeMode && pendingEdits && pendingEdits.size > 0 && (
              <span className="ml-2 text-amber-600 dark:text-amber-400 font-medium">· {pendingEdits.size} pending</span>
            )}
          </span>

          {/* Search */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchMode === "value" ? "Search value…" : "Search…"}
                className="w-full rounded-md border border-border bg-secondary pl-7 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
              />
              {searchQuery && (
                <button
                  onMouseDown={(e) => { e.preventDefault(); setSearchQuery(""); }}
                  title="Clear"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <select
              value={searchMode}
              onChange={(e) => setSearchMode(e.target.value as "name" | "value" | "both")}
              className="shrink-0 rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              <option value="name">Name</option>
              <option value="value">Value</option>
              <option value="both">Both</option>
            </select>
          </div>

          {/* Action buttons — icon only on mobile, icon+text on sm+ */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowCsvModal(true)}
              title="Export as CSV"
              className="flex items-center gap-1.5 rounded-md border border-border px-2 sm:px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileDown className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            {canDiff && (
              <button
                onClick={() => setShowDiffsOnly((v) => !v)}
                title={showDiffsOnly ? "Show all" : "Show differences only"}
                className={`flex items-center gap-1.5 rounded-md border px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  showDiffsOnly
                    ? "border-amber-500/50 bg-amber-400/10 text-amber-700 dark:border-amber-400/50 dark:text-amber-300"
                    : "border-border text-foreground hover:bg-secondary"
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{showDiffsOnly ? "Differences only" : "Show differences"}</span>
              </button>
            )}
            {writeMode && pendingEdits && pendingEdits.size > 0 && (
              <>
                <button
                  onClick={() => setShowModifiedOnly((v) => !v)}
                  title={showModifiedOnly ? "Show all" : `Show modified (${pendingEdits.size})`}
                  className={`flex items-center gap-1.5 rounded-md border px-2 sm:px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    showModifiedOnly ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-secondary"
                  }`}
                >
                  <GitCompareArrows className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">{showModifiedOnly ? `Modified (${pendingEdits.size})` : `Show modified (${pendingEdits.size})`}</span>
                  <span className="sm:hidden text-xs">{pendingEdits.size}</span>
                </button>
                <button
                  onClick={onClearAllEdits}
                  title="Discard all pending edits"
                  className="flex items-center gap-1.5 rounded-md border border-border px-2 sm:px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden sm:inline">Discard</span>
                </button>
                {onWriteToDrone && (
                  <button
                    onClick={onWriteToDrone}
                    title={`Write ${pendingEdits.size} params to drone`}
                    className="flex items-center gap-1.5 rounded-md bg-amber-500 px-2 sm:px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Upload className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">Write {pendingEdits.size}</span>
                    <span className="sm:hidden">{pendingEdits.size}</span>
                  </button>
                )}
                {onSaveCatalog && (
                  <button
                    onClick={onSaveCatalog}
                    disabled={savingCatalog}
                    title={savingCatalog ? "Saving…" : `Save ${pendingEdits.size} changes`}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-2 sm:px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <Upload className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">{savingCatalog ? "Saving…" : `Save ${pendingEdits.size}`}</span>
                    <span className="sm:hidden">{pendingEdits.size}</span>
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className={versions.length === 1 ? "mx-auto max-w-3xl" : ""}>
          <table
            className="border-collapse w-full"
            style={{ tableLayout: "fixed", minWidth: colWidths.reduce((a, b) => a + b, 0) }}
          >
            <colgroup>
              {colWidths.map((w, i) => (
                <col key={i} style={i === colWidths.length - 1 ? undefined : { width: w }} />
              ))}
            </colgroup>
          <thead className="sticky top-0 z-30">
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="sticky left-0 z-20 bg-secondary px-4 py-2.5 text-left font-medium overflow-hidden" style={{ width: colWidths[0], boxShadow: "inset -1px 0 0 hsl(var(--border))" }}>
                Param
                <ResizeHandle colIndex={0} />
              </th>
              {versions.map((v, i) => (
                <th
                  key={v.id}
                  title={`${v.clientName} — ${v.familyName} / ${v.variantName}`}
                  className="relative px-3 py-2 text-left font-medium bg-secondary overflow-hidden"
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="rounded bg-primary/20 border border-primary/40 px-1.5 py-px font-mono text-[10px] font-bold text-primary shrink-0">v{v.label}</span>
                    {writableVersionId === v.id && writeMode && (
                      <span className="rounded px-1 py-px text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 shrink-0">editing</span>
                    )}
                  </div>
                  <div className="text-foreground font-semibold truncate text-xs mt-0.5">{v.clientName}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{v.familyName} / {v.variantName}</div>
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
                    <td className={`sticky left-0 z-10 overflow-hidden ${i % 2 === 0 ? "bg-card" : "bg-secondary/30"}`} style={{ maxWidth: 0, boxShadow: "inset -1px 0 0 hsl(var(--border))" }}>
                      <div className="flex items-center gap-1 px-4 py-2 group/name">
                        {row.isDiff && (
                          <span className="mr-0.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 dark:bg-amber-400 align-middle shrink-0" />
                        )}
                        <span className="font-mono text-xs text-foreground truncate min-w-0">
                          {row.name}
                        </span>
                        {LOCKED_PARAMS.has(row.name) && (
                          <span className="ml-1 text-[9px] text-muted-foreground/60 shrink-0" title="Managed by app — cannot be edited manually">🔒</span>
                        )}
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
                      const rawValue = row.values[vid];
                      const isMissing = rawValue === undefined;
                      const isWritable = writeMode && vid === writableVersionId && !isMissing && !LOCKED_PARAMS.has(row.name);
                      const pendingValue = pendingEdits?.get(row.name);
                      const hasPending = isWritable && pendingValue !== undefined;
                      const displayValue = hasPending ? String(pendingValue) : rawValue;
                      const isInvalid = !isMissing && def ? validateParam(displayValue ?? "", def) !== null : false;
                      const isDiffCell = row.isDiff && !isMissing;
                      const cellKey = `${row.name}:${vid}`;
                      const isEditing = editingCell === cellKey;

                      const rowBg = i % 2 === 0 ? "" : "bg-secondary/30";
                      let cellClass = "px-4 py-2 font-mono text-xs overflow-hidden whitespace-nowrap transition-colors max-w-0 ";
                      if (hasPending) {
                        cellClass += "bg-amber-500/25 text-amber-900 dark:text-amber-100 font-semibold";
                      } else if (isInvalid) {
                        cellClass += "bg-destructive/20 text-destructive";
                      } else if (isDiffCell) {
                        cellClass += "bg-amber-400/15 text-amber-900 dark:text-amber-200";
                      } else if (isMissing) {
                        cellClass += `${rowBg} text-muted-foreground italic`;
                      } else {
                        cellClass += `${rowBg} text-foreground`;
                      }

                      if (isEditing) {
                        return (
                          <td key={vid} className="px-2 py-1 max-w-0 bg-amber-400/20">
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                type="text"
                                value={editInput}
                                onChange={(e) => setEditInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    (e.target as HTMLInputElement).blur();
                                  } else if (e.key === "Escape") {
                                    setEditInput("__cancel__");
                                    setTimeout(() => setEditingCell(null), 0);
                                  }
                                }}
                                onBlur={() => {
                                  if (editInput === "__cancel__") {
                                    setEditingCell(null);
                                    return;
                                  }
                                  const trimmed = editInput.trim();
                                  const originalValue = displayValue ?? "";
                                  if (trimmed === "" || trimmed === String(originalValue)) {
                                    setEditingCell(null);
                                    return;
                                  }
                                  const num = parseFloat(trimmed);
                                  if (!isNaN(num)) onEditParam?.(row.name, num);
                                  setEditingCell(null);
                                }}
                                className="flex-1 min-w-0 rounded-sm border border-amber-500 bg-card px-1.5 py-1 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-amber-500"
                              />
                              {hasPending && (
                                <button
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    onClearEdit?.(row.name);
                                    setEditingCell(null);
                                  }}
                                  title="Discard edit"
                                  className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      }

                      // Cells in editable columns: clicking activates write mode
                      // for that column and immediately opens the input.
                      const isLocked = LOCKED_PARAMS.has(row.name);
                      const isEditable = onToggleWriteMode && vid !== "live" && !isMissing && !isLocked;
                      return (
                        <td
                          key={vid}
                          className={cellClass + (isWritable ? " cursor-text hover:bg-amber-400/20" : isEditable ? " cursor-text hover:bg-secondary/60" : "")}
                          onClick={() => {
                            if (isWritable) {
                              setEditInput(displayValue ?? "");
                              setEditingCell(cellKey);
                            } else if (isEditable) {
                              // Activate write mode for this column, then start editing
                              onToggleWriteMode(vid);
                              setEditInput(displayValue ?? "");
                              setEditingCell(cellKey);
                            }
                          }}
                          title={isLocked ? "Managed by app — cannot be edited" : isWritable || isEditable ? "Click to edit" : undefined}
                        >
                          {isMissing ? "—" : displayValue}
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
                  {showModifiedOnly
                    ? "No modified params yet."
                    : showDiffsOnly
                    ? "All params are identical across selected versions."
                    : "No params found."}
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>

    {showCsvModal && <CsvModal
      versions={versions}
      visibleRows={visibleRows}
      showDiffsOnly={showDiffsOnly}
      csvCopied={csvCopied}
      setCsvCopied={setCsvCopied}
      onClose={() => setShowCsvModal(false)}
    />}
    </>
  );
}

function CsvModal({
  versions,
  visibleRows,
  showDiffsOnly,
  csvCopied,
  setCsvCopied,
  onClose,
}: {
  versions: import("@/lib/types").CompareVersion[];
  visibleRows: { name: string; values: Record<string, string>; isDiff: boolean }[];
  showDiffsOnly: boolean;
  csvCopied: boolean;
  setCsvCopied: (v: boolean) => void;
  onClose: () => void;
}) {
  const header = ["Param", ...versions.map((v) => `${v.clientName} v${v.label}`)].join(",");
  const csvRows = visibleRows.map((row) => {
    const cells = [
      row.name,
      ...versions.map((v) => {
        const val = row.values[v.id];
        return val === undefined ? "" : val;
      }),
    ].map((c) => (String(c).includes(",") || String(c).includes('"') ? `"${String(c).replace(/"/g, '""')}"` : c));
    return cells.join(",");
  });
  const csv = [header, ...csvRows].join("\n");
  const label = showDiffsOnly ? `differences only (${visibleRows.length} rows)` : `all params (${visibleRows.length} rows)`;

  function downloadCsv() {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compare-${versions.map((v) => `${v.clientName}-v${v.label}`).join("-vs-")}.csv`.replace(/\s+/g, "_");
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function copyCsv() {
    navigator.clipboard.writeText(csv).then(() => {
      setCsvCopied(true);
      setTimeout(() => setCsvCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-foreground">Export CSV</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">Exporting {label}</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-3">
          <pre className="text-[11px] font-mono text-muted-foreground bg-secondary/50 rounded-md p-3 whitespace-pre overflow-x-auto leading-relaxed">
            {csv.slice(0, 2000)}{csv.length > 2000 ? `\n… (${csvRows.length} rows total)` : ""}
          </pre>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border bg-toolbar px-5 py-3 shrink-0">
          <button
            onClick={copyCsv}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
          >
            {csvCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {csvCopied ? "Copied!" : "Copy to clipboard"}
          </button>
          <button
            onClick={downloadCsv}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
          >
            <FileDown className="h-3.5 w-3.5" />
            Download CSV
          </button>
        </div>
      </div>
    </div>
  );
}
