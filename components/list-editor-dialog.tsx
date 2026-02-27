"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { X, Plus, Trash2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import type { ProtectionList } from "@/lib/types";

interface ListEditorDialogProps {
  onClose: () => void;
}

const MAX_SUGGESTIONS = 12;

export function ListEditorDialog({ onClose }: ListEditorDialogProps) {
  const { protectionLists, setProtectionLists, log, paramDefs, pdefGroups } =
    useApp();

  const [lists, setLists] = useState<ProtectionList[]>(() =>
    JSON.parse(JSON.stringify(protectionLists))
  );
  const [selectedIdx, setSelectedIdx] = useState(lists.length > 0 ? 0 : -1);

  // Rule input
  const [ruleType, setRuleType] = useState<"prefix" | "exact">("prefix");
  const [ruleInput, setRuleInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIdx, setSuggestionIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // New list inline form
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");

  const selectedList = selectedIdx >= 0 ? lists[selectedIdx] : null;

  // Autocomplete suggestions filtered by type and query, excluding already-added rules
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
      .filter((s) => s.toUpperCase().includes(q))
      .sort((a, b) => {
        const aStarts = a.toUpperCase().startsWith(q);
        const bStarts = b.toUpperCase().startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [ruleInput, ruleType, paramDefs, pdefGroups, lists, selectedIdx]);

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
      rules.splice(ruleIdx, 1);
      updated[selectedIdx] = { ...updated[selectedIdx], rules };
      setLists(updated);
    },
    [selectedIdx, lists]
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
    setShowNewList(false);
    setNewListName("");
    setNewListDesc("");
  }, [newListName, newListDesc, lists]);

  const handleDeleteList = useCallback(() => {
    if (selectedIdx < 0) return;
    const updated = lists.filter((_, i) => i !== selectedIdx);
    setLists(updated);
    setSelectedIdx(updated.length > 0 ? 0 : -1);
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
    inputRef.current?.focus();
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
      <div className="flex w-full max-w-4xl max-h-[90vh] flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">

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
          {/* ── Left sidebar ── */}
          <div className="flex w-55 flex-col border-r border-border bg-background/30 shrink-0">
            <div className="px-3 py-2 border-b border-border">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Lists
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
              {lists.map((pl, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedIdx(i)}
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

          {/* ── Right panel ── */}
          <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
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
                            : "e.g. MOT_THST_HOVER  →  exact name"
                        }
                        className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-1 focus:ring-ring"
                      />

                      {/* Suggestions dropdown */}
                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-border bg-card shadow-2xl overflow-y-auto max-h-48">
                          {suggestions.map((s, i) => (
                            <button
                              key={s}
                              onMouseDown={() => addRule(s)}
                              className={cn(
                                "flex w-full items-center px-3 py-1.5 text-xs font-mono text-left transition-colors",
                                i === suggestionIdx
                                  ? "bg-primary/20 text-foreground"
                                  : "text-foreground hover:bg-secondary"
                              )}
                            >
                              {s}
                            </button>
                          ))}
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
                            {prefixRules.map(({ rule, origIdx }) => (
                              <span
                                key={origIdx}
                                className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1 text-xs font-mono text-foreground"
                              >
                                <span className="text-muted-foreground/60 text-[10px]">
                                  pre:
                                </span>
                                {rule.value}
                                <button
                                  onClick={() => removeRule(origIdx)}
                                  className="text-muted-foreground hover:text-destructive-foreground transition-colors ml-0.5"
                                  aria-label={`Remove rule ${rule.value}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
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
                            {exactRules.map(({ rule, origIdx }) => (
                              <span
                                key={origIdx}
                                className="flex items-center gap-1.5 rounded-md border border-blue-900/40 bg-blue-950/30 px-2.5 py-1 text-xs font-mono text-foreground"
                              >
                                <span className="text-blue-400/60 text-[10px]">
                                  ex:
                                </span>
                                {rule.value}
                                <button
                                  onClick={() => removeRule(origIdx)}
                                  className="text-muted-foreground hover:text-destructive-foreground transition-colors ml-0.5"
                                  aria-label={`Remove rule ${rule.value}`}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </span>
                            ))}
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
