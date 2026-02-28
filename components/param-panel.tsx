"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronRight, ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { buildGroups } from "@/lib/param-engine";
import { useApp } from "@/lib/app-context";
import { ValueCell } from "@/components/value-cell";
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
        className="bg-amber-400/25 text-amber-200 rounded-xs px-px not-italic"
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
// Kept in one place so column header and rows stay aligned.
const COL_CHECKBOX = "w-7 shrink-0";
const COL_NAME     = "flex-1 min-w-0";
const COL_VALUE    = "w-20 shrink-0";

// ---------- component ----------

interface ParamPanelProps {
  title: string;
  headerColor: string;
  variant?: "protected" | "applied";
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
  headerColor,
  variant,
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
  const { paramDefs, paramNotes, selectedParam } = useApp();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("name");

  const groups = useMemo(() => buildGroups(params, pdefGroups), [params, pdefGroups]);

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

  const q = searchQuery.trim();
  const isSearching = q.length > 0;

  return (
    <div className="flex flex-1 flex-col rounded-lg border border-border bg-card overflow-hidden min-w-0">
      {/* Panel header */}
      <div className={cn("flex items-center gap-2 px-3 py-2.5", headerColor)}>
        <input
          type="checkbox"
          checked={allChecked}
          ref={(el) => {
            if (el) el.indeterminate = someChecked && !allChecked;
          }}
          onChange={(e) => onToggleAll(e.target.checked)}
          className="h-4 w-4 rounded accent-foreground cursor-pointer"
          aria-label="Select all parameters"
        />
        <span className="flex-1 text-sm font-semibold text-foreground truncate">
          {title} ({params.length})
        </span>
        {headerAction}
      </div>

      {/* Search bar */}
      {params.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border">
          <div className="relative flex-1 min-w-0">
            <input
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
              className="w-full rounded bg-muted px-2.5 py-1.5 pr-7 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <select
            value={searchMode}
            onChange={(e) => setSearchMode(e.target.value as SearchMode)}
            className="shrink-0 rounded bg-muted px-2 py-1.5 text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            <option value="name">Name</option>
            <option value="description">Description</option>
            <option value="both">Both</option>
          </select>
        </div>
      )}

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredGroups.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            {params.length === 0 ? "No parameters loaded" : "No matching parameters"}
          </div>
        ) : (
          <>
            {/* Sticky column header */}
            <div className="sticky top-0 z-20 flex items-center border-b border-border bg-toolbar px-2 py-1">
              <div className={COL_CHECKBOX} />
              <div className={cn(COL_NAME, "text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pl-1")}>
                Parameter
              </div>
              <div className={cn(COL_VALUE, "text-[10px] font-semibold text-muted-foreground uppercase tracking-wider pr-1")}>
                Value
              </div>
            </div>

            {filteredGroups.map((group) => {
              const isOpen = isSearching || expandedGroups.has(group.label);
              const groupNames = group.params.map((p) => p.name);
              const groupAllChecked = groupNames.every((n) => checkedNames.has(n));
              const groupSomeChecked = groupNames.some((n) => checkedNames.has(n));

              return (
                <div key={group.label}>
                  {/* Sticky group header — sits below the column header */}
                  <div
                    onClick={() => onToggleGroup(groupNames)}
                    className="sticky top-7 z-10 flex w-full items-center gap-1.5 border-b border-border bg-secondary/50 px-2 py-1 text-left hover:bg-secondary/70 transition-colors cursor-pointer"
                  >
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleGroup(group.label); }}
                      className="shrink-0 p-0.5 -m-0.5 rounded hover:bg-secondary transition-colors"
                    >
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </span>
                    <input
                      type="checkbox"
                      checked={groupAllChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = groupSomeChecked && !groupAllChecked;
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleGroup(groupNames)}
                      className="h-3.5 w-3.5 rounded accent-foreground cursor-pointer"
                      aria-label={`Select all in ${group.label}`}
                    />
                    <span className="flex-1 min-w-0 flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-group-text truncate">
                        {group.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        #{group.params.length}
                      </span>
                    </span>
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

                      return (
                        <motion.div
                          key={param.name}
                          data-param={param.name}
                          initial={{ opacity: 0, x: variant === "protected" ? -16 : 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: variant === "protected" ? 16 : -16 }}
                          transition={{ duration: 0.15, ease: "easeOut" }}
                          className={cn(
                            "flex items-start border-b border-border/30 pl-8 pr-2 py-1 transition-colors cursor-pointer border-l-4",
                            selectedParam?.name === param.name
                              ? "bg-primary/10 border-l-primary/60"
                              : variant === "protected"
                              ? "bg-protected/5 hover:bg-protected/12 border-l-red-400/35"
                              : variant === "applied"
                              ? "bg-secondary/10 hover:bg-secondary/20 border-l-group-text/30"
                              : "hover:bg-secondary/30 border-l-transparent"
                          )}
                          onClick={() => { onToggleCheck(param.name); onSelectParam(param.name, param.value); }}
                        >
                          {/* Checkbox col */}
                          <div className={cn(COL_CHECKBOX, "flex justify-center pt-0.5")}>
                            <input
                              type="checkbox"
                              checked={checkedNames.has(param.name)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => onToggleCheck(param.name)}
                              className="h-3.5 w-3.5 rounded accent-foreground cursor-pointer"
                              aria-label={`Select ${param.name}`}
                            />
                          </div>

                          {/* Name col */}
                          <div className={cn(COL_NAME, "flex flex-col gap-0.5 pl-1")}>
                            <span className="font-mono text-xs text-foreground truncate">
                              {nameMatches ? highlightText(param.name, q) : param.name}
                            </span>
                            {snippet && (
                              <span className="font-sans text-[10px] text-muted-foreground leading-snug">
                                {highlightText(snippet, q)}
                              </span>
                            )}
                            {noteSnippet && (
                              <span className="font-sans text-[10px] text-amber-400/70 leading-snug">
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
                              onOverride={(v) => onOverrideValue(param.name, v)}
                            />
                          ) : (
                            <div className={cn(COL_VALUE, "font-mono text-xs text-muted-foreground tabular-nums pt-0.5 pr-1 text-right")}>
                              {param.value}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
