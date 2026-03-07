"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  GitCommitHorizontal,
  GitCompareArrows,
} from "lucide-react";

interface VersionNode {
  id: string;
  label: string;
  isLatest: boolean;
}

interface ParamSetNode {
  id: string;
  name: string;
  versions: VersionNode[];
}

interface DroneNode {
  id: string;
  name: string;
  slug: string;
  paramSets: ParamSetNode[];
}

interface Props {
  tree: DroneNode[];
}

export function VersionTree({ tree }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [collapsedDrones, setCollapsedDrones] = useState<Set<string>>(new Set());
  const [collapsedSets, setCollapsedSets] = useState<Set<string>>(new Set());

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDrone(id: string) {
    setCollapsedDrones((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSet(id: string) {
    setCollapsedSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCompare() {
    const params = new URLSearchParams();
    for (const id of checked) params.append("v", id);
    router.push(`/catalog/compare?${params.toString()}`);
  }

  const selectedCount = checked.size;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <h1 className="text-base font-semibold text-foreground">Compare params</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select 2 or more versions to compare side-by-side.
        </p>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        {tree.length === 0 ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">
            No versions available in the catalog yet.
          </p>
        ) : (
          tree.map((drone) => {
            const isDroneCollapsed = collapsedDrones.has(drone.id);
            return (
              <div key={drone.id}>
                {/* Drone row */}
                <button
                  onClick={() => toggleDrone(drone.id)}
                  className="flex items-center gap-2 w-full px-4 py-1.5 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
                >
                  {isDroneCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  {isDroneCollapsed ? (
                    <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <FolderOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                  {drone.name}
                </button>

                {!isDroneCollapsed &&
                  drone.paramSets.map((ps) => {
                    const isSetCollapsed = collapsedSets.has(ps.id);
                    return (
                      <div key={ps.id}>
                        {/* Param set row */}
                        <button
                          onClick={() => toggleSet(ps.id)}
                          className="flex items-center gap-2 w-full pl-9 pr-4 py-1.5 text-sm text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
                        >
                          {isSetCollapsed ? (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          {isSetCollapsed ? (
                            <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span>{ps.name}</span>
                          <span className="text-muted-foreground text-xs">
                            ({ps.versions.length})
                          </span>
                        </button>

                        {!isSetCollapsed &&
                          ps.versions.map((v) => (
                            <div
                              key={v.id}
                              onClick={() => toggleCheck(v.id)}
                              className="flex items-center gap-2 pl-[4.5rem] pr-4 py-1.5 hover:bg-secondary/50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checked.has(v.id)}
                                onChange={() => toggleCheck(v.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="h-3.5 w-3.5 rounded border-border cursor-pointer accent-primary shrink-0"
                              />
                              <GitCommitHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-sm font-mono text-foreground">v{v.label}</span>
                              {v.isLatest && (
                                <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary leading-none">
                                  latest
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    );
                  })}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border bg-toolbar px-6 py-3 flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground flex-1">
          {selectedCount === 0
            ? "No versions selected"
            : `${selectedCount} version${selectedCount !== 1 ? "s" : ""} selected`}
        </span>
        <button
          onClick={handleCompare}
          disabled={selectedCount < 2}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
        >
          <GitCompareArrows className="h-3.5 w-3.5" />
          Compare{selectedCount >= 2 ? ` (${selectedCount})` : ""}
        </button>
      </div>
    </div>
  );
}
