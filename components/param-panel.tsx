"use client";

import { useState, useMemo, useCallback } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildGroups } from "@/lib/param-engine";
import type { Param } from "@/lib/types";

interface ParamPanelProps {
  title: string;
  headerColor: string;
  params: Param[];
  checkedNames: Set<string>;
  pdefGroups: string[];
  onToggleCheck: (name: string) => void;
  onToggleAll: (checked: boolean) => void;
  onToggleGroup: (paramNames: string[]) => void;
  onSelectParam: (name: string, value: string) => void;
  headerAction?: React.ReactNode;
}

export function ParamPanel({
  title,
  headerColor,
  params,
  checkedNames,
  pdefGroups,
  onToggleCheck,
  onToggleAll,
  onToggleGroup,
  onSelectParam,
  headerAction,
}: ParamPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const groups = useMemo(() => buildGroups(params, pdefGroups), [params, pdefGroups]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toUpperCase();
    return groups
      .map((g) => ({
        ...g,
        params: g.params.filter((p) => p.name.includes(q)),
      }))
      .filter((g) => g.params.length > 0);
  }, [groups, searchQuery]);

  const allChecked = params.length > 0 && params.every((p) => checkedNames.has(p.name));
  const someChecked = params.some((p) => checkedNames.has(p.name));

  const toggleGroup = useCallback(
    (label: string) => {
      setExpandedGroups((prev) => {
        const next = new Set(prev);
        if (next.has(label)) next.delete(label);
        else next.add(label);
        return next;
      });
    },
    []
  );

  return (
    <div className="flex flex-1 flex-col rounded-lg border border-border bg-card overflow-hidden min-w-0">
      {/* Header */}
      <div
        className={cn("flex items-center gap-2 px-3 py-2.5", headerColor)}
      >
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

      {/* Search */}
      {params.length > 0 && (
        <div className="px-2 py-1.5 border-b border-border">
          <input
            type="text"
            placeholder="Search params..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded bg-muted px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      )}

      {/* Param list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filteredGroups.length === 0 && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            {params.length === 0
              ? "No parameters loaded"
              : "No matching parameters"}
          </div>
        )}
        {filteredGroups.map((group) => {
          const isOpen = expandedGroups.has(group.label);
          const groupNames = group.params.map((p) => p.name);
          const groupAllChecked = groupNames.every((n) => checkedNames.has(n));
          const groupSomeChecked = groupNames.some((n) => checkedNames.has(n));

          return (
            <div key={group.label}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.label)}
                className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-secondary/50 transition-colors"
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <input
                  type="checkbox"
                  checked={groupAllChecked}
                  ref={(el) => {
                    if (el)
                      el.indeterminate = groupSomeChecked && !groupAllChecked;
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggleGroup(groupNames)}
                  className="h-3.5 w-3.5 rounded accent-foreground cursor-pointer"
                  aria-label={`Select all in ${group.label}`}
                />
                <span className="text-xs font-semibold text-group-text truncate">
                  {group.label}
                </span>
                <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
                  {group.params.length}
                </span>
              </button>

              {/* Group params */}
              {isOpen && (
                <div>
                  {group.params.map((param) => (
                    <div
                      key={param.name}
                      className="flex items-center gap-2 py-1 pl-9 pr-3 hover:bg-secondary/30 transition-colors cursor-pointer"
                      onClick={() => onSelectParam(param.name, param.value)}
                    >
                      <input
                        type="checkbox"
                        checked={checkedNames.has(param.name)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => onToggleCheck(param.name)}
                        className="h-3.5 w-3.5 shrink-0 rounded accent-foreground cursor-pointer"
                        aria-label={`Select ${param.name}`}
                      />
                      <span className="flex-1 truncate font-mono text-xs text-foreground">
                        {param.name}
                      </span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                        {param.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
