"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { X, Plus, Trash2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import type { ProtectionList, ParamDefinition } from "@/lib/types";

type SuggestionMode = "name" | "description" | "both";

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
      <mark key={idx} className="bg-amber-400/25 text-amber-200 rounded-xs px-px not-italic">
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

// ---------- component ----------

interface ListEditorDialogProps {
  onClose: () => void;
}

export function ListEditorDialog({ onClose }: ListEditorDialogProps) {
  const { protectionLists, setProtectionLists, log, paramDefs, pdefGroups } =
    useApp();

  const [lists, setLists] = useState<ProtectionList[]>(() =>
    JSON.parse(JSON.stringify(protectionLists))
  );
  const [selectedIdx, setSelectedIdx] = useState(lists.length > 0 ? 0 : -1);
  const [selectedRule, setSelectedRule] = useState<{
    type: "prefix" | "exact";
    value: string;
  } | null>(null);

  // Rule input
  const [ruleType, setRuleType] = useState<"prefix" | "exact">("prefix");
  const [ruleInput, setRuleInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIdx, setSuggestionIdx] = useState(-1);
  const [suggestionMode, setSuggestionMode] = useState<SuggestionMode>("name");
  const inputRef = useRef<HTMLInputElement>(null);

  // New list inline form
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");

  const selectedList = selectedIdx >= 0 ? lists[selectedIdx] : null;

  // Autocomplete suggestions filtered by type, mode, and query — excluding already-added rules
  const suggestions = useMemo(() => {
    const q = ruleInput.trim().toUpperCase();
    if (!q) return [];
    const existing = new Set(
      (lists[selectedIdx]?.rules ?? [])
        .filter((r) => r.type === ruleType)
        .map((r) => r.value)
    );
    const pool =
      ruleType === "prefix" ? pdefGroups : Object.keys(paramDefs);

    return pool
      .filter((s) => !existing.has(s.toUpperCase()))
      .filter((s) => {
        const nameMatch = s.toUpperCase().includes(q);
        // prefix pool has no descriptions — always filter by name
        if (ruleType === "prefix" || suggestionMode === "name") return nameMatch;
        const def = paramDefs[s];
        const descMatch =
          (def?.Description ?? "").toUpperCase().includes(q) ||
          (def?.DisplayName ?? "").toUpperCase().includes(q);
        if (suggestionMode === "description") return descMatch;
        return nameMatch || descMatch; // "both"
      })
      .sort((a, b) => {
        const aStarts = a.toUpperCase().startsWith(q);
        const bStarts = b.toUpperCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      });
  }, [ruleInput, ruleType, suggestionMode, paramDefs, pdefGroups, lists, selectedIdx]);

  // Info panel content derived from the selected rule
  const ruleInfo = useMemo(() => {
    if (!selectedRule) return null;
    if (selectedRule.type === "exact") {
      const def: ParamDefinition = paramDefs[selectedRule.value] ?? {};
      return { kind: "exact" as const, def };
    }
    const prefix = selectedRule.value;
    const matches = Object.entries(paramDefs)
      .filter(([name]) => name.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b));
    return { kind: "prefix" as const, matches };
  }, [selectedRule, paramDefs]);

  const addRule = useCallback(
    (value: string) => {
      if (selectedIdx < 0 || !value.trim()) return;
      const v = value.trim().toUpperCase();
      if (lists[selectedIdx].rules.some((r) => r.type === ruleType && r.value === v))
        return;
      const updated = [...lists];
      updated[selectedIdx] = {
        ...updated[selectedIdx],
        rules: [...updated[selectedIdx].rules, { type: ruleType, value: v }],
      };
      setLists(updated);
      setRuleInput("");
      setShowSuggestions(false);
      setSuggestionIdx(-1);
    },
    [selectedIdx, ruleType, lists]
  );

  const removeRule = useCallback(
    (ruleIdx: number) => {
      if (selectedIdx < 0) return;
      const updated = [...lists];
      const rules = [...updated[selectedIdx].rules];
      const removed = rules[ruleIdx];
      if (
        selectedRule &&
        selectedRule.type === removed.type &&
        selectedRule.value === removed.value
      ) {
        setSelectedRule(null);
      }
      rules.splice(ruleIdx, 1);
      updated[selectedIdx] = { ...updated[selectedIdx], rules };
      setLists(updated);
    },
    [selectedIdx, lists, selectedRule]
  );

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionIdx((i) => Math.min(i + 1, suggestions.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionIdx((i) => Math.max(i - 1, -1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (suggestionIdx >= 0 && suggestions[suggestionIdx]) {
          addRule(suggestions[suggestionIdx]);
        } else {
          addRule(ruleInput);
        }
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
      }
    },
    [suggestions, suggestionIdx, ruleInput, addRule]
  );

  const handleNewList = useCallback(() => {
    if (!newListName.trim()) return;
    const newList: ProtectionList = {
      name: newListName.trim(),
      description: newListDesc.trim(),
      rules: [],
    };
    const updated = [...lists, newList];
    setLists(updated);
    setSelectedIdx(updated.length - 1);
    setSelectedRule(null);
    setShowNewList(false);
    setNewListName("");
    setNewListDesc("");
  }, [newListName, newListDesc, lists]);

  const handleDeleteList = useCallback(() => {
    if (selectedIdx < 0) return;
    const updated = lists.filter((_, i) => i !== selectedIdx);
    setLists(updated);
    setSelectedIdx(updated.length > 0 ? 0 : -1);
    setSelectedRule(null);
  }, [selectedIdx, lists]);

  const handleSave = useCallback(() => {
    setProtectionLists(lists);
    log("Protection lists updated");
    onClose();
  }, [lists, setProtectionLists, log, onClose]);

  const switchType = useCallback((t: "prefix" | "exact") => {
    setRuleType(t);
    setRuleInput("");
    setSuggestionIdx(-1);
    // prefix pool (pdefGroups) has no descriptions — reset to name mode
    if (t === "prefix") setSuggestionMode("name");
    inputRef.current?.focus();
  }, []);

  const switchList = useCallback((i: number) => {
    setSelectedIdx(i);
    setSelectedRule(null);
  }, []);

  // Rules split by type for grouped display
  const prefixRules = selectedList?.rules
    .map((r, i) => ({ rule: r, origIdx: i }))
    .filter(({ rule }) => rule.type === "prefix") ?? [];
  const exactRules = selectedList?.rules
    .map((r, i) => ({ rule: r, origIdx: i }))
    .filter(({ rule }) => rule.type === "exact") ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex w-full max-w-5xl max-h-[90vh] flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 border-b border-border bg-toolbar px-5 py-3.5 shrink-0">
          <Shield className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-foreground leading-none">
              Protection Lists
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Define which parameters are protected from being overwritten
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* ── Lists sidebar ── */}
          <div className="flex w-52 flex-col border-r border-border bg-background/30 shrink-0">
            <div className="px-3 py-2 border-b border-border">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Lists
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
              {lists.map((pl, i) => (
                <button
                  key={i}
                  onClick={() => switchList(i)}
                  className={cn(
                    "flex items-center gap-2 w-full rounded-md px-3 py-2.5 text-left transition-colors border",
                    i === selectedIdx
                      ? "bg-primary/15 border-primary/30 text-foreground"
                      : "border-transparent text-secondary-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <span className="flex-1 text-sm font-medium truncate">
                    {pl.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                      i === selectedIdx
                        ? "bg-primary/30 text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {pl.rules.length}
                  </span>
                </button>
              ))}
            </div>

            {/* New list inline form / add button */}
            {showNewList ? (
              <div className="border-t border-border p-3 flex flex-col gap-2 shrink-0">
                <input
                  autoFocus
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleNewList();
                    if (e.key === "Escape") {
                      setShowNewList(false);
                      setNewListName("");
                      setNewListDesc("");
                    }
                  }}
                  placeholder="List name..."
                  className="w-full rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                />
                <input
                  type="text"
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                />
                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      setShowNewList(false);
                      setNewListName("");
                      setNewListDesc("");
                    }}
                    className="flex-1 rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleNewList}
                    disabled={!newListName.trim()}
                    className="flex-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30"
                  >
                    Create
                  </button>
                </div>
              </div>
            ) : (
              <div className="border-t border-border p-2 flex gap-1.5 shrink-0">
                <button
                  onClick={() => setShowNewList(true)}
                  className="flex-1 flex items-center justify-center gap-1 rounded-md border border-dashed border-border px-2 py-1.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New List
                </button>
                <button
                  onClick={handleDeleteList}
                  disabled={selectedIdx < 0}
                  className="flex items-center justify-center rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-destructive/20 hover:border-destructive hover:text-destructive-foreground transition-colors disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* ── Rules editor (center) ── */}
          <div className="flex flex-1 flex-col min-w-0 overflow-hidden border-r border-border">
            {selectedList ? (
              <>
                {/* List info */}
                <div className="border-b border-border px-5 py-3.5 shrink-0">
                  <h3 className="text-sm font-bold text-foreground">
                    {selectedList.name}
                  </h3>
                  {selectedList.description && (
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      {selectedList.description}
                    </p>
                  )}
                </div>

                {/* Add rule area */}
                <div className="border-b border-border px-5 py-4 shrink-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
                    Add Rule
                  </p>

                  {/* Type toggle */}
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs text-muted-foreground w-10 shrink-0">
                      Type
                    </span>
                    <div className="flex rounded-md border border-border overflow-hidden text-xs font-medium">
                      <button
                        onClick={() => switchType("prefix")}
                        className={cn(
                          "px-3 py-1.5 transition-colors",
                          ruleType === "prefix"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        )}
                      >
                        PREFIX
                      </button>
                      <button
                        onClick={() => switchType("exact")}
                        className={cn(
                          "px-3 py-1.5 transition-colors border-l border-border",
                          ruleType === "exact"
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground hover:text-foreground"
                        )}
                      >
                        EXACT
                      </button>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {ruleType === "prefix"
                        ? "protects any param whose name starts with this"
                        : "protects only this exact parameter name"}
                    </span>
                  </div>

                  {/* Autocomplete input */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-10 shrink-0">
                      Value
                    </span>
                    <div className="relative flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className="relative flex-1 min-w-0">
                          <input
                            ref={inputRef}
                            type="text"
                            value={ruleInput}
                            onChange={(e) => {
                              setRuleInput(e.target.value);
                              setShowSuggestions(true);
                              setSuggestionIdx(-1);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() =>
                              setTimeout(() => setShowSuggestions(false), 150)
                            }
                            onKeyDown={handleInputKeyDown}
                            placeholder={
                              ruleType === "prefix"
                                ? "e.g. COMPASS_OFS  →  starts with"
                                : suggestionMode === "description"
                                ? "search by description..."
                                : "e.g. MOT_THST_HOVER  →  exact name"
                            }
                            className="w-full rounded-md border border-border bg-secondary px-3 py-2 pr-7 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring"
                          />
                          {ruleInput && (
                            <button
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setRuleInput("");
                                setShowSuggestions(false);
                                setSuggestionIdx(-1);
                                inputRef.current?.focus();
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              aria-label="Clear input"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {ruleType === "exact" && (
                          <select
                            value={suggestionMode}
                            onChange={(e) =>
                              setSuggestionMode(e.target.value as SuggestionMode)
                            }
                            className="shrink-0 rounded-md border border-border bg-secondary px-2 py-2 text-xs text-muted-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                          >
                            <option value="name">Name</option>
                            <option value="description">Description</option>
                            <option value="both">Both</option>
                          </select>
                        )}
                      </div>

                      {/* Suggestions dropdown */}
                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-border bg-card shadow-2xl overflow-y-auto max-h-48">
                          {suggestions.map((s, i) => {
                            const q = ruleInput.trim();
                            const def = paramDefs[s];
                            const descSource = def?.Description || def?.DisplayName || "";
                            const nameMatches =
                              suggestionMode !== "description" &&
                              s.toUpperCase().includes(q.toUpperCase());
                            const descMatches =
                              ruleType === "exact" &&
                              suggestionMode !== "name" &&
                              descSource.toUpperCase().includes(q.toUpperCase());
                            const snippet = descMatches
                              ? getSnippet(descSource, q)
                              : null;

                            return (
                              <button
                                key={s}
                                onMouseDown={() => addRule(s)}
                                className={cn(
                                  "flex w-full flex-col items-start px-3 py-1.5 text-xs text-left transition-colors",
                                  i === suggestionIdx
                                    ? "bg-primary/20 text-foreground"
                                    : "text-foreground hover:bg-secondary"
                                )}
                              >
                                <span className="font-mono">
                                  {nameMatches ? highlightText(s, q) : s}
                                </span>
                                {snippet && (
                                  <span className="font-sans text-[10px] text-muted-foreground mt-0.5 leading-snug">
                                    {highlightText(snippet, q)}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => addRule(ruleInput)}
                      disabled={!ruleInput.trim()}
                      className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30 shrink-0"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                </div>

                {/* Rules list */}
                <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
                  {selectedList.rules.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Shield className="h-10 w-10 text-muted-foreground/20 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No rules yet
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        Add prefix or exact rules above to protect parameters
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {prefixRules.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2.5">
                            Prefix rules
                            <span className="normal-case ml-1 text-muted-foreground/60">
                              — protects any param starting with
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {prefixRules.map(({ rule, origIdx }) => {
                              const isSelected =
                                selectedRule?.type === "prefix" &&
                                selectedRule.value === rule.value;
                              return (
                                <span
                                  key={origIdx}
                                  className={cn(
                                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-mono transition-colors",
                                    isSelected
                                      ? "border-primary/50 bg-primary/15 text-foreground"
                                      : "border-border bg-secondary text-foreground"
                                  )}
                                >
                                  <button
                                    onClick={() =>
                                      setSelectedRule(
                                        isSelected
                                          ? null
                                          : { type: "prefix", value: rule.value }
                                      )
                                    }
                                    className="flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span
                                      className={cn(
                                        "text-[10px]",
                                        isSelected
                                          ? "text-primary/70"
                                          : "text-muted-foreground/60"
                                      )}
                                    >
                                      pre:
                                    </span>
                                    {rule.value}
                                  </button>
                                  <button
                                    onClick={() => removeRule(origIdx)}
                                    className="text-muted-foreground hover:text-destructive-foreground transition-colors ml-0.5"
                                    aria-label={`Remove rule ${rule.value}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {exactRules.length > 0 && (
                        <div>
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2.5">
                            Exact rules
                            <span className="normal-case ml-1 text-muted-foreground/60">
                              — protects this specific parameter
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {exactRules.map(({ rule, origIdx }) => {
                              const isSelected =
                                selectedRule?.type === "exact" &&
                                selectedRule.value === rule.value;
                              return (
                                <span
                                  key={origIdx}
                                  className={cn(
                                    "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-mono transition-colors",
                                    isSelected
                                      ? "border-primary/50 bg-primary/15 text-foreground"
                                      : "border-blue-900/40 bg-blue-950/30 text-foreground"
                                  )}
                                >
                                  <button
                                    onClick={() =>
                                      setSelectedRule(
                                        isSelected
                                          ? null
                                          : { type: "exact", value: rule.value }
                                      )
                                    }
                                    className="flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span
                                      className={cn(
                                        "text-[10px]",
                                        isSelected
                                          ? "text-primary/70"
                                          : "text-blue-400/60"
                                      )}
                                    >
                                      ex:
                                    </span>
                                    {rule.value}
                                  </button>
                                  <button
                                    onClick={() => removeRule(origIdx)}
                                    className="text-muted-foreground hover:text-destructive-foreground transition-colors ml-0.5"
                                    aria-label={`Remove rule ${rule.value}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center">
                <Shield className="h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">
                  Select a list to edit
                </p>
              </div>
            )}
          </div>

          {/* ── Info panel (right) ── */}
          <div className="flex w-64 flex-col shrink-0">
            <div className="px-3 py-2 border-b border-border">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Parameter Info
              </span>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">
              {!selectedRule ? (
                <div className="flex items-center justify-center h-full text-center px-4">
                  <p className="text-xs text-muted-foreground">
                    Click a rule to see details
                  </p>
                </div>
              ) : ruleInfo?.kind === "exact" ? (
                <ExactRuleInfo value={selectedRule.value} def={ruleInfo.def} />
              ) : ruleInfo?.kind === "prefix" ? (
                <PrefixRuleInfo
                  value={selectedRule.value}
                  matches={ruleInfo.matches}
                />
              ) : null}
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-border bg-toolbar px-5 py-3 shrink-0">
          <p className="text-xs text-muted-foreground">
            {selectedList
              ? `${selectedList.rules.length} rule${selectedList.rules.length !== 1 ? "s" : ""} in this list`
              : ""}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Info sub-components ----------

function InfoLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
      {children}
    </span>
  );
}

function ExactRuleInfo({
  value,
  def,
}: {
  value: string;
  def: import("@/lib/types").ParamDefinition;
}) {
  const hasInfo = def.DisplayName || def.Description;
  return (
    <div className="flex flex-col gap-3 p-4">
      <div>
        <p className="font-mono text-sm font-bold text-foreground">{value}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">Exact match</p>
      </div>

      {def.DisplayName && (
        <div className="flex flex-col gap-0.5">
          <InfoLabel>Label</InfoLabel>
          <p className="text-xs text-foreground">{def.DisplayName}</p>
        </div>
      )}

      {def.Description && (
        <div className="flex flex-col gap-0.5">
          <InfoLabel>Description</InfoLabel>
          <p className="text-xs text-foreground leading-relaxed">
            {def.Description}
          </p>
        </div>
      )}

      {def.Units && (
        <div className="flex flex-col gap-0.5">
          <InfoLabel>Units</InfoLabel>
          <p className="text-xs text-foreground">{def.Units}</p>
        </div>
      )}

      {def.Range && (
        <div className="flex flex-col gap-0.5">
          <InfoLabel>Range</InfoLabel>
          <p className="font-mono text-xs text-foreground">
            {def.Range.low} – {def.Range.high}
          </p>
        </div>
      )}

      {def.Values && Object.keys(def.Values).length > 0 && (
        <div className="flex flex-col gap-0.5">
          <InfoLabel>Allowed Values</InfoLabel>
          <div className="flex flex-col gap-0.5 mt-0.5">
            {Object.entries(def.Values).map(([k, v]) => (
              <p key={k} className="font-mono text-xs text-foreground">
                <span className="text-muted-foreground">{k}</span> = {v}
              </p>
            ))}
          </div>
        </div>
      )}

      {def.Bitmask && Object.keys(def.Bitmask).length > 0 && (
        <div className="flex flex-col gap-0.5">
          <InfoLabel>Bitmask</InfoLabel>
          <div className="flex flex-col gap-0.5 mt-0.5">
            {Object.entries(def.Bitmask).map(([bit, label]) => (
              <p key={bit} className="font-mono text-xs text-foreground">
                <span className="text-muted-foreground">bit {bit}:</span>{" "}
                {label}
              </p>
            ))}
          </div>
        </div>
      )}

      {def.RebootRequired === "True" && (
        <div className="rounded bg-destructive/20 px-3 py-2 text-xs font-medium text-destructive-foreground">
          Reboot required after change
        </div>
      )}

      {!hasInfo && (
        <p className="text-xs text-muted-foreground italic">
          No definition found in ArduPilot database
        </p>
      )}
    </div>
  );
}

function PrefixRuleInfo({
  value,
  matches,
}: {
  value: string;
  matches: [string, import("@/lib/types").ParamDefinition][];
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border shrink-0">
        <p className="font-mono text-sm font-bold text-foreground">
          {value}
          <span className="text-muted-foreground">*</span>
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Prefix — {matches.length} matching param{matches.length !== 1 ? "s" : ""}
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-2 leading-relaxed">
          ArduPilot does not publish group-level descriptions. Showing matched
          params from the official database.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {matches.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground italic">
            No matching parameters found in the database
          </p>
        ) : (
          <div className="divide-y divide-border">
            {matches.map(([name, def]) => (
              <div key={name} className="px-4 py-2.5">
                <p className="font-mono text-xs font-semibold text-foreground">
                  {name}
                </p>
                {def.DisplayName && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {def.DisplayName}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
