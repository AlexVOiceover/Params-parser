"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Search, RotateCcw, EyeOff } from "lucide-react";

/**
 * Hide whole parameter groups from the compare table.
 *
 * Groups come from ArduPilot's apm.pdef.json (served by /api/param-definitions),
 * whose top-level keys are the prefixes themselves — AHRS_, COMPASS_, ADSB_ and
 * so on. Nothing is hardcoded, so a group ArduPilot adds later appears here on
 * its own.
 */

export const HIDDEN_PREFIXES_KEY = "air6_compare_hidden_prefixes";

/** Prefix of a param name, e.g. COMPASS_OFS_X -> COMPASS_. Null when ungrouped. */
export function prefixOf(paramName: string): string | null {
  const m = /^([A-Z0-9]+?)_/.exec(paramName);
  return m ? `${m[1]}_` : null;
}

export function readHiddenPrefixes(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_PREFIXES_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed as string[]);
  } catch {}
  return new Set();
}

function writeHiddenPrefixes(hidden: Set<string>): void {
  try { localStorage.setItem(HIDDEN_PREFIXES_KEY, JSON.stringify([...hidden])); } catch {}
}

interface Props {
  /** Prefixes present in the rows being compared, with how many rows each covers. */
  countsByPrefix: Map<string, number>;
  /** How many of those rows currently differ, so noisy groups are easy to spot. */
  diffCountsByPrefix: Map<string, number>;
  hidden: Set<string>;
  onChange: (next: Set<string>) => void;
  onClose: () => void;
}

export function PrefixFilterModal({
  countsByPrefix,
  diffCountsByPrefix,
  hidden,
  onChange,
  onClose,
}: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = useMemo(() => {
    const q = query.trim().toUpperCase();
    return [...countsByPrefix.entries()]
      .filter(([p]) => !q || p.includes(q))
      .sort((a, b) => {
        // Groups with the most differences first — those are what clutter the view.
        const d = (diffCountsByPrefix.get(b[0]) ?? 0) - (diffCountsByPrefix.get(a[0]) ?? 0);
        return d !== 0 ? d : a[0].localeCompare(b[0]);
      });
  }, [countsByPrefix, diffCountsByPrefix, query]);

  function toggle(prefix: string) {
    const next = new Set(hidden);
    if (next.has(prefix)) next.delete(prefix); else next.add(prefix);
    onChange(next);
    writeHiddenPrefixes(next);
  }

  function setAll(next: Set<string>) {
    onChange(next);
    writeHiddenPrefixes(next);
  }

  const shownCount = countsByPrefix.size - hidden.size;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Hide parameter groups</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-3 shrink-0 flex flex-col gap-2.5">
          <p className="text-xs text-muted-foreground">
            Tick a group to hide it from the table and from CSV export. Useful for
            hardware-specific groups that always differ but rarely matter.
          </p>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search groups…"
              aria-label="Search parameter groups"
              className="w-full rounded-md border border-border bg-secondary pl-8 pr-7 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
            />
            {query && (
              <button
                onMouseDown={(e) => { e.preventDefault(); setQuery(""); }}
                aria-label="Clear search"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">
              {shownCount} of {countsByPrefix.size} shown
            </span>
            {hidden.size > 0 && (
              <button
                onClick={() => setAll(new Set())}
                className="ml-auto flex items-center gap-1 rounded border border-border px-2 py-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="h-3 w-3" />
                Show all
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto border-t border-border divide-y divide-border">
          {rows.length === 0 && (
            <p className="px-5 py-8 text-center text-xs text-muted-foreground italic">
              No groups match &ldquo;{query}&rdquo;.
            </p>
          )}
          {rows.map(([prefix, count]) => {
            const diffs = diffCountsByPrefix.get(prefix) ?? 0;
            const isHidden = hidden.has(prefix);
            return (
              <label
                key={prefix}
                className="flex items-center gap-3 px-5 py-2 cursor-pointer hover:bg-secondary/50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isHidden}
                  onChange={() => toggle(prefix)}
                  className="h-3.5 w-3.5 cursor-pointer accent-primary shrink-0"
                />
                <span className={`font-mono text-xs ${isHidden ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {prefix}
                </span>
                <span className="ml-auto flex items-center gap-2 shrink-0 text-[10px] tabular-nums">
                  {diffs > 0 && (
                    <span className="rounded bg-amber-400/15 border border-amber-500/30 px-1.5 py-px font-semibold text-amber-700 dark:text-amber-400">
                      {diffs} differ
                    </span>
                  )}
                  <span className="text-muted-foreground">{count}</span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-toolbar px-5 py-3 shrink-0">
          <button
            onClick={onClose}
            className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
