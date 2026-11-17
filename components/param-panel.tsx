"use client";

import { useState, useMemo, useCallback, useEffect, useId } from "react";
import { ChevronDown, X, Search, TriangleAlert, ChevronsDownUp, ChevronsUpDown, Shield, FileCheck2, FilePlus, type LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { buildGroups, validateParam } from "@/lib/param-engine";
import { useApp } from "@/lib/app-context";
import { ValueCell } from "@/components/value-cell";
import { LoadingPanel } from "@/components/ui/busy";
import { buttonClass, cardClass, fieldClass } from "@/components/ui/styles";
import type { Param } from "@/lib/types";

type SearchMode = "name" | "description" | "both";

// ---------- helpers ----------

function highlightText(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const q = query.toUpperCase();
  const upper = text.toUpperCase();
  const nodes: React.ReactNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const idx = upper.indexOf(q, cursor);
    if (idx === -1) {
      nodes.push(text.slice(cursor));
      break;
    }
    if (idx > cursor) nodes.push(text.slice(cursor, idx));
    nodes.push(
      <mark
        key={idx}
        className="bg-amber-400/25 text-amber-900 dark:text-amber-200 rounded-xs px-px not-italic"
      >
        {text.slice(idx, idx + query.length)}
      </mark>
    );
    cursor = idx + query.length;
  }

  return <>{nodes}</>;
}

function getSnippet(text: string, query: string, radius = 45): string {
  if (!text || !query) return "";
  const idx = text.toUpperCase().indexOf(query.toUpperCase());
  if (idx === -1) return "";
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + query.length + radius);
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
}

// ---------- layout constants ----------
// Kept in one place so the column labels, group bands and rows stay aligned:
// names start 72px in (chevron + checkbox), values sit in one fixed column.
const COL_VALUE = "w-32 shrink-0";
const NAME_INDENT = "pl-18";

export type PanelTone = "protected" | "applied" | "defaults";

const TONE: Record<PanelTone, { band: string; title: string; icon: LucideIcon }> = {
  protected: { band: "border-red-500/25 bg-protected", title: "text-protected-text", icon: Shield },
  applied: { band: "border-emerald-600/25 bg-applied", title: "text-applied-text", icon: FileCheck2 },
  defaults: { band: "border-emerald-600/25 bg-emerald-500/15", title: "text-emerald-800 dark:text-emerald-200", icon: FilePlus },
};

// ---------- component ----------

interface ParamPanelProps {
  title: string;
  tone: PanelTone;
  variant?: "protected" | "applied";
  isActive?: boolean;
  /** A source is being fetched: the empty list shows a spinner instead of its empty text. */
  loading?: boolean;
  params: Param[];
  checkedNames: Set<string>;
  pdefGroups: string[];
  onToggleCheck: (name: string) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleGroup: (paramNames: string[]) => void;
  onSelectParam: (name: string, value: string) => void;
  headerAction?: React.ReactNode;
  valueOverrides?: Map<string, string>;
  onOverrideValue?: (name: string, value: string) => void;
}

export function ParamPanel({
  title,
  tone,
  variant,
  isActive,
  loading = false,
  params,
  checkedNames,
  pdefGroups,
  onToggleCheck,
  onToggleAll,
  onToggleGroup,
  onSelectParam,
  headerAction,
  valueOverrides,
  onOverrideValue,
}: ParamPanelProps) {
  const { paramDefs, paramNotes, selectedParam, acknowledgedInvalid } = useApp();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("name");
  const [showInvalidOnly, setShowInvalidOnly] = useState(false);
  const searchId = useId();
  const modeId = useId();

  const groups = useMemo(() => buildGroups(params, pdefGroups), [params, pdefGroups]);

  const invalidNames = useMemo(() => {
    if (!onOverrideValue) return new Set<string>();
    const set = new Set<string>();
    for (const p of params) {
      if (acknowledgedInvalid.has(p.name)) continue;
      const def = paramDefs[p.name];
      if (!def) continue;
      const effectiveValue = valueOverrides?.get(p.name) ?? p.value;
      if (validateParam(effectiveValue, def) !== null) set.add(p.name);
    }
    return set;
  }, [params, valueOverrides, paramDefs, onOverrideValue, acknowledgedInvalid]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return groups;

    return groups
      .map((g) => ({
        ...g,
        params: g.params.filter((p) => {
          const nameMatch = p.name.toUpperCase().includes(q);
          if (searchMode === "name") return nameMatch;

          const def = paramDefs[p.name];
          const descMatch =
            (def?.Description ?? "").toUpperCase().includes(q) ||
            (def?.DisplayName ?? "").toUpperCase().includes(q);
          const noteMatch = (paramNotes[p.name] ?? "").toUpperCase().includes(q);

          if (searchMode === "description") return descMatch || noteMatch;
          return nameMatch || descMatch || noteMatch;
        }),
      }))
      .filter((g) => g.params.length > 0);
  }, [groups, searchQuery, searchMode, paramDefs, paramNotes]);

  const displayGroups = useMemo(() => {
    if (!showInvalidOnly) return filteredGroups;
    return filteredGroups
      .map((g) => ({ ...g, params: g.params.filter((p) => invalidNames.has(p.name)) }))
      .filter((g) => g.params.length > 0);
  }, [filteredGroups, showInvalidOnly, invalidNames]);

  const allChecked = params.length > 0 && params.every((p) => checkedNames.has(p.name));
  const someChecked = params.some((p) => checkedNames.has(p.name));

  const toggleGroup = useCallback((label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedGroups(new Set(groups.map((g) => g.label)));
  }, [groups]);

  const collapseAll = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return;
      if (e.key === "e" || e.key === "E") { e.preventDefault(); expandAll(); }
      if (e.key === "c" || e.key === "C") { e.preventDefault(); collapseAll(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isActive, expandAll, collapseAll]);

  // Auto-clear the invalid-only filter when no invalid params remain
  useEffect(() => {
    if (showInvalidOnly && invalidNames.size === 0) {
      setShowInvalidOnly(false);
    }
  }, [showInvalidOnly, invalidNames.size]);

  const q = searchQuery.trim();
  const isSearching = q.length > 0;
  const { band, title: titleTone, icon: ToneIcon } = TONE[tone];

  return (
    <div className={cn(cardClass, "flex min-w-0 flex-1 flex-col overflow-hidden")}>
      {/* Panel header */}
      <div className={cn("flex min-h-12 shrink-0 flex-wrap items-center gap-x-2.5 gap-y-1.5 border-b px-3 py-2", band)}>
        <input
          type="checkbox"
          checked={allChecked}
          ref={(el) => {
            if (el) el.indeterminate = someChecked && !allChecked;
          }}
          onChange={(e) => onToggleAll(e.target.checked)}
          aria-label="Select all parameters"
        />
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card/70", titleTone)} aria-hidden="true">
          <ToneIcon className="h-4 w-4" />
        </span>
        <h2 className={cn("min-w-32 flex-1 truncate text-sm font-semibold", titleTone)}>
          {title} ({params.length})
        </h2>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      {/* Search bar */}
      {params.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2">
          <div className="relative min-w-40 flex-1">
            <label htmlFor={searchId} className="sr-only">Search parameters</label>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              id={searchId}
              type="text"
              placeholder={
                searchMode === "name"
                  ? "Search by name..."
                  : searchMode === "description"
                  ? "Search by description..."
                  : "Search name or description..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn(fieldClass, "h-8 w-full pl-8 pr-7 text-[13px]")}
            />
            {searchQuery && (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); setSearchQuery(""); }}
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <label htmlFor={modeId} className="sr-only">Search in</label>
          <select
            id={modeId}
            value={searchMode}
            onChange={(e) => setSearchMode(e.target.value as SearchMode)}
            className={cn(fieldClass, "h-8 shrink-0 text-[13px] cursor-pointer")}
          >
            <option value="name">Name</option>
            <option value="description">Description</option>
            <option value="both">Both</option>
          </select>
          {onOverrideValue && invalidNames.size > 0 && (
            <button
              type="button"
              aria-pressed={showInvalidOnly}
              onClick={() => setShowInvalidOnly((v) => !v)}
              title={showInvalidOnly ? "Show all params" : "Show only invalid params"}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium tabular-nums transition-colors cursor-pointer whitespace-nowrap",
                showInvalidOnly
                  ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300"
                  : "border-border bg-card text-red-700 shadow-xs hover:bg-red-500/10 dark:text-red-300"
              )}
            >
              <TriangleAlert className="h-3.5 w-3.5" />
              {showInvalidOnly ? "All" : invalidNames.size}
            </button>
          )}
          {groups.length > 0 && !isSearching && (
            <div className="flex shrink-0 items-center">
              <div className="group relative">
                <button type="button" onClick={collapseAll} aria-label="Collapse all" className={buttonClass("ghost", "icon")}>
                  <ChevronsDownUp className="h-4 w-4" />
                </button>
                <div className="pointer-events-none absolute right-0 top-full z-50 mt-1 hidden rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground whitespace-nowrap shadow-md group-hover:block">
                  Collapse all (<u>c</u>)
                </div>
              </div>
              <div className="group relative">
                <button type="button" onClick={expandAll} aria-label="Expand all" className={buttonClass("ghost", "icon")}>
                  <ChevronsUpDown className="h-4 w-4" />
                </button>
                <div className="pointer-events-none absolute right-0 top-full z-50 mt-1 hidden rounded-md border border-border bg-popover px-2 py-1 text-xs text-popover-foreground whitespace-nowrap shadow-md group-hover:block">
                  Expand all (<u>e</u>)
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scrollable list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {displayGroups.length === 0 ? (
          loading && params.length === 0 ? (
            <LoadingPanel label="Loading parameters…" />
          ) : (
            <div className="flex items-center justify-center px-4 py-12 text-center text-sm text-muted-foreground">
              {params.length === 0 ? "No parameters loaded" : showInvalidOnly ? "No invalid parameters" : "No matching parameters"}
            </div>
          )
        ) : (
          <>
            {/* Sticky column labels */}
            <div className={cn("sticky top-0 z-20 flex h-8 items-center border-b border-border bg-card pr-1 text-xs font-medium text-muted-foreground", NAME_INDENT)}>
              <div className="min-w-0 flex-1">Parameter</div>
              <div className={cn(COL_VALUE, "px-2 text-right")}>Value</div>
            </div>

            <AnimatePresence initial={false}>
            {displayGroups.map((group) => {
              const isOpen = isSearching || expandedGroups.has(group.label);
              const groupNames = group.params.map((p) => p.name);
              const groupAllChecked = groupNames.every((n) => checkedNames.has(n));
              const groupSomeChecked = groupNames.some((n) => checkedNames.has(n));

              return (
                <motion.div
                  key={group.label}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                >
                  {/* Sticky group band, pinned under the column labels. The outer layer keeps it opaque over scrolling rows. */}
                  <div className="sticky top-8 z-10 bg-card">
                    <div
                      onClick={() => onToggleGroup(groupNames)}
                      className="flex h-8 w-full cursor-pointer items-center gap-2 border-b border-border bg-secondary/60 px-2 text-left transition-colors hover:bg-secondary"
                    >
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={`${isOpen ? "Collapse" : "Expand"} ${group.label}`}
                        title={`${isOpen ? "Collapse" : "Expand"} ${group.label}`}
                        onClick={(e) => { e.stopPropagation(); toggleGroup(group.label); }}
                        className={cn(buttonClass("ghost", "icon"), "hover:bg-border/70")}
                      >
                        <ChevronDown className={cn("h-4 w-4 transition-transform", !isOpen && "-rotate-90")} />
                      </button>
                      <input
                        type="checkbox"
                        checked={groupAllChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = groupSomeChecked && !groupAllChecked;
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => onToggleGroup(groupNames)}
                        aria-label={`Select all in ${group.label}`}
                      />
                      <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                        <span className="truncate text-[13px] font-semibold text-foreground">
                          {group.label}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          #{group.params.length}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Param rows */}
                  <AnimatePresence initial={false}>
                    {isOpen &&
                    group.params.map((param) => {
                      const def = paramDefs[param.name];
                      const descSource = def?.Description || def?.DisplayName || "";
                      const noteSource = paramNotes[param.name] ?? "";

                      const nameMatches =
                        isSearching &&
                        searchMode !== "description" &&
                        param.name.toUpperCase().includes(q.toUpperCase());

                      const descMatches =
                        isSearching &&
                        searchMode !== "name" &&
                        descSource.toUpperCase().includes(q.toUpperCase());

                      const noteMatches =
                        isSearching &&
                        searchMode !== "name" &&
                        noteSource.toUpperCase().includes(q.toUpperCase());

                      const snippet = descMatches ? getSnippet(descSource, q) : null;
                      const noteSnippet = noteMatches ? getSnippet(noteSource, q) : null;

                      const isSelected = selectedParam?.name === param.name;
                      const hasOverride = !!onOverrideValue && valueOverrides?.has(param.name) === true;
                      const effectiveValue = valueOverrides?.get(param.name) ?? param.value;
                      const rowIsInvalid = !!onOverrideValue && !!def && validateParam(effectiveValue, def) !== null;
                      const rowIsAcknowledged = !!onOverrideValue && acknowledgedInvalid.has(param.name);

                      return (
                        <motion.div
                          key={param.name}
                          data-param={param.name}
                          initial={{ opacity: 0, x: variant === "protected" ? -16 : 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: variant === "protected" ? 16 : -16 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className={cn(
                            // The left border is both the guide line under the group's chevron and the row's state colour.
                            "relative ml-6 flex cursor-pointer items-start border-b border-l-2 border-b-border/60 py-0.5 pl-5.5 pr-1 transition-colors",
                            "before:absolute before:left-0 before:top-4 before:h-px before:w-3.5 before:bg-border",
                            isSelected
                              ? cn(
                                  "bg-primary/10",
                                  rowIsInvalid && !rowIsAcknowledged ? "border-l-red-500"
                                  : rowIsAcknowledged ? "border-l-blue-500"
                                  : hasOverride ? "border-l-amber-500"
                                  : "border-l-primary"
                                )
                              : variant === "protected"
                              ? "bg-red-500/5 hover:bg-red-500/10 border-l-red-500/40"
                              : rowIsInvalid && !rowIsAcknowledged
                              ? "bg-red-500/10 hover:bg-red-500/15 border-l-red-500"
                              : rowIsAcknowledged
                              ? "bg-blue-500/10 hover:bg-blue-500/15 border-l-blue-500"
                              : hasOverride
                              ? "bg-amber-500/10 hover:bg-amber-500/15 border-l-amber-500"
                              : variant === "applied"
                              ? "hover:bg-secondary/60 border-l-border"
                              : "hover:bg-secondary/60 border-l-transparent"
                          )}
                          onClick={() => {
                            if (variant !== "applied") onToggleCheck(param.name);
                            onSelectParam(param.name, valueOverrides?.get(param.name) ?? param.value);
                          }}
                        >
                          {/* Checkbox col */}
                          <div className="flex h-7 shrink-0 items-center">
                            <input
                              type="checkbox"
                              checked={checkedNames.has(param.name)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => onToggleCheck(param.name)}
                              aria-label={`Select ${param.name}`}
                            />
                          </div>

                          {/* Name col */}
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1 pl-2">
                            <span className={cn(
                              "font-mono text-[13px] truncate",
                              !isSelected && rowIsInvalid && !rowIsAcknowledged ? "text-red-700 dark:text-red-300"
                              : !isSelected && rowIsAcknowledged ? "text-blue-700 dark:text-blue-300"
                              : !isSelected && hasOverride ? "text-amber-700 dark:text-amber-300"
                              : "text-foreground"
                            )}>
                              {nameMatches ? highlightText(param.name, q) : param.name}
                            </span>
                            {snippet && (
                              <span className="font-sans text-[10px] text-muted-foreground leading-snug">
                                {highlightText(snippet, q)}
                              </span>
                            )}
                            {noteSnippet && (
                              <span className="font-sans text-[10px] text-amber-700 dark:text-amber-400/70 leading-snug">
                                ✎ {highlightText(noteSnippet, q)}
                              </span>
                            )}
                          </div>

                          {/* Value col */}
                          {onOverrideValue ? (
                            <ValueCell
                              className={COL_VALUE}
                              originalValue={param.value}
                              override={valueOverrides?.get(param.name)}
                              onOverride={(v) => {
                                onOverrideValue(param.name, v);
                                if (selectedParam?.name === param.name) {
                                  onSelectParam(param.name, v !== "" ? v : param.value);
                                }
                              }}
                              isInvalid={!!def && validateParam(valueOverrides?.get(param.name) ?? param.value, def) !== null}
                              isAcknowledged={acknowledgedInvalid.has(param.name)}
                            />
                          ) : (
                            <div className={cn(COL_VALUE, "flex h-7 items-center justify-end px-2 font-mono text-[13px] text-muted-foreground tabular-nums")}>
                              {param.value}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              );
            })}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}
