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
  Usb,
} from "lucide-react";
import { useDroneParams, DRONE_VERSION_ID } from "@/lib/drone-params-context";

interface VersionNode {
  id: string;
  label: string;
  isLatest: boolean;
}

interface VariantNode {
  id: string;
  name: string;
  versions: VersionNode[];
}

interface FamilyNode {
  id: string;
  name: string;
  slug: string;
  variants: VariantNode[];
}

interface Props {
  tree: FamilyNode[];
}

export function VersionTree({ tree }: Props) {
  const router = useRouter();
  const { droneParams } = useDroneParams();
  const hasDroneParams = droneParams !== null && droneParams.length > 0;
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [collapsedFamilies, setCollapsedFamilies] = useState<Set<string>>(new Set());
  const [collapsedVariants, setCollapsedVariants] = useState<Set<string>>(new Set());

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFamily(id: string) {
    setCollapsedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleVariant(id: string) {
    setCollapsedVariants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCompare() {
    const params = new URLSearchParams();
    for (const id of checked) params.append("v", id);
    const url = `/compare?${params.toString()}`;
    router.push(url);
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
        {/* Connected drone — appears when params are imported */}
        {hasDroneParams && (
          <div
            onClick={() => toggleCheck(DRONE_VERSION_ID)}
            className="flex items-center gap-2 w-full px-4 py-2 hover:bg-secondary/50 cursor-pointer border-b border-border/50 mb-1"
          >
            <input
              type="checkbox"
              checked={checked.has(DRONE_VERSION_ID)}
              onChange={() => toggleCheck(DRONE_VERSION_ID)}
              onClick={(e) => e.stopPropagation()}
              className="h-3.5 w-3.5 rounded border-border cursor-pointer accent-primary shrink-0"
            />
            <Usb className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="text-sm font-medium text-foreground">Connected drone</span>
            <span className="rounded-full bg-emerald-900/50 border border-emerald-700/60 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 leading-none">
              {droneParams!.length} params
            </span>
          </div>
        )}

        {tree.length === 0 && !hasDroneParams ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">
            No versions available in the catalog yet.
          </p>
        ) : (
          tree.map((family) => {
            const isFamilyCollapsed = collapsedFamilies.has(family.id);
            return (
              <div key={family.id}>
                {/* Family row */}
                <button
                  onClick={() => toggleFamily(family.id)}
                  className="flex items-center gap-2 w-full px-4 py-1.5 text-sm font-medium text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
                >
                  {isFamilyCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                  {isFamilyCollapsed ? (
                    <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <FolderOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                  )}
                  {family.name}
                </button>

                {!isFamilyCollapsed &&
                  family.variants.map((variant) => {
                    const isVariantCollapsed = collapsedVariants.has(variant.id);
                    return (
                      <div key={variant.id}>
                        {/* Variant row */}
                        <button
                          onClick={() => toggleVariant(variant.id)}
                          className="flex items-center gap-2 w-full pl-9 pr-4 py-1.5 text-sm text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
                        >
                          {isVariantCollapsed ? (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          {isVariantCollapsed ? (
                            <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <span>{variant.name}</span>
                          <span className="text-muted-foreground text-xs">
                            ({variant.versions.length})
                          </span>
                        </button>

                        {!isVariantCollapsed &&
                          variant.versions.map((v) => (
                            <div
                              key={v.id}
                              onClick={() => toggleCheck(v.id)}
                              className="flex items-center gap-2 pl-18 pr-4 py-1.5 hover:bg-secondary/50 cursor-pointer"
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
          disabled={selectedCount < 1}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
        >
          <GitCompareArrows className="h-3.5 w-3.5" />
          {selectedCount >= 2 ? `Compare (${selectedCount})` : selectedCount === 1 ? "View" : "Select versions"}
        </button>
      </div>
    </div>
  );
}
