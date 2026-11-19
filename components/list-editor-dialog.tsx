"use client";

import { useState, useCallback, useRef, useMemo, useId } from "react";
import { X, Plus, Trash2, Shield, Globe, User, Power } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/status-badge";
import { buttonClass, fieldClass, labelClass } from "@/components/ui/styles";
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
      <mark key={idx} className="bg-amber-400/25 text-amber-900 dark:text-amber-200 rounded-xs px-px not-italic">
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

/** One option of a two-way switch (User / Global, PREFIX / EXACT). */
function segmentClass(active: boolean): string {
  return cn(
    "flex h-full flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap",
    active ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
  );
}

const segmentGroupClass = "flex h-8 shrink-0 items-center rounded-lg border border-border bg-secondary p-0.5";
const columnTitleClass = "text-xs font-medium text-muted-foreground";

// ---------- component ----------

interface ListEditorDialogProps {
  onClose: () => void;
}

export function ListEditorDialog({ onClose }: ListEditorDialogProps) {
  const { protectionLists, setProtectionLists, log, paramDefs, pdefGroups } =
    useApp();
  const { role } = useAuth();
  const isAdmin = role === "admin";

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
  const [newListIsGlobal, setNewListIsGlobal] = useState(false);

  const titleId = useId();
  const newNameId = useId();
  const newDescId = useId();
  const nameId = useId();
  const descId = useId();
  const typeLabelId = useId();
  const ruleInputId = useId();
  const modeId = useId();

  const selectedList = selectedIdx >= 0 ? lists[selectedIdx] : null;
  const isReadOnly = !!selectedList?.isGlobal && !isAdmin;

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
      ...(isAdmin && newListIsGlobal ? { isGlobal: true } : {}),
    };
    const updated = [...lists, newList];
    setLists(updated);
    setSelectedIdx(updated.length - 1);
    setSelectedRule(null);
    setShowNewList(false);
    setNewListName("");
    setNewListDesc("");
    setNewListIsGlobal(false);
  }, [newListName, newListDesc, lists, isAdmin, newListIsGlobal]);

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

  const updateSelectedList = useCallback(
    (patch: Partial<Pick<ProtectionList, "name" | "description" | "isGlobal">>) => {
      if (selectedIdx < 0) return;
      const updated = [...lists];
      updated[selectedIdx] = { ...updated[selectedIdx], ...patch };
      setLists(updated);
    },
    [selectedIdx, lists]
  );

  // Rules split by type for grouped display
  const prefixRules = selectedList?.rules
    .map((r, i) => ({ rule: r, origIdx: i }))
    .filter(({ rule }) => rule.type === "prefix") ?? [];
  const exactRules = selectedList?.rules
    .map((r, i) => ({ rule: r, origIdx: i }))
    .filter(({ rule }) => rule.type === "exact") ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
      >

        {/* ── Header ── */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              Protection Lists
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Define which parameters are protected from being overwritten
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            className={buttonClass("ghost", "icon", "ml-auto -mr-1.5")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
          {/* ── Lists sidebar ── */}
          <div className="flex shrink-0 flex-col border-b border-border bg-secondary/40 md:w-56 md:border-b-0 md:border-r">
            <div className="px-4 pb-1 pt-3">
              <h3 className={columnTitleClass}>
                Lists
              </h3>
            </div>

            <div className="flex max-h-44 flex-col gap-1 overflow-y-auto p-2 md:max-h-none md:flex-1">
              {lists.map((pl, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => switchList(i)}
                  className={cn(
                    "flex min-h-9 w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors cursor-pointer",
                    i === selectedIdx
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-transparent text-foreground hover:bg-secondary"
                  )}
                >
                  {pl.isGlobal ? (
                    <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="flex-1 truncate text-[13px] font-medium">
                    {pl.name}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                      i === selectedIdx
                        ? "bg-primary/15 text-primary"
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
              <div className="flex shrink-0 flex-col gap-2 border-t border-border p-3">
                <label htmlFor={newNameId} className="sr-only">List name</label>
                <input
                  id={newNameId}
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
                  className={cn(fieldClass, "h-8 w-full px-2.5 text-[13px]")}
                />
                <label htmlFor={newDescId} className="sr-only">Description</label>
                <input
                  id={newDescId}
                  type="text"
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  placeholder="Description (optional)"
                  className={cn(fieldClass, "h-8 w-full px-2.5 text-[13px]")}
                />
                {isAdmin && (
                  <div role="radiogroup" aria-label="Who can use the list" className={segmentGroupClass}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!newListIsGlobal}
                      onClick={() => setNewListIsGlobal(false)}
                      className={segmentClass(!newListIsGlobal)}
                    >
                      <User className="h-3.5 w-3.5" />
                      User
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={newListIsGlobal}
                      onClick={() => setNewListIsGlobal(true)}
                      className={segmentClass(newListIsGlobal)}
                    >
                      <Globe className="h-3.5 w-3.5" />
                      Global
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewList(false);
                      setNewListName("");
                      setNewListDesc("");
                    }}
                    className={buttonClass("ghost", "sm", "flex-1")}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleNewList}
                    disabled={!newListName.trim()}
                    className={buttonClass("secondary", "sm", "flex-1")}
                  >
                    Create
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex shrink-0 gap-1.5 border-t border-border p-2">
                <button
                  type="button"
                  onClick={() => setShowNewList(true)}
                  className={buttonClass("secondary", "sm", "flex-1")}
                >
                  <Plus className="h-3.5 w-3.5" />
                  New List
                </button>
                <button
                  type="button"
                  onClick={handleDeleteList}
                  disabled={selectedIdx < 0 || isReadOnly}
                  aria-label="Delete list"
                  title="Delete list"
                  className={buttonClass("dangerGhost", "icon")}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* ── Rules editor (center) ── */}
          <div className="flex min-w-0 flex-1 flex-col border-b border-border md:overflow-hidden md:border-b-0 md:border-r">
            {selectedList ? (
              <>
                {/* List info */}
                <div className="flex shrink-0 flex-col gap-2 border-b border-border px-5 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {isReadOnly ? (
                      <h3 className="min-w-0 flex-1 text-sm font-semibold text-foreground">
                        {selectedList.name}
                      </h3>
                    ) : (
                      <>
                        <label htmlFor={nameId} className="sr-only">List name</label>
                        <input
                          id={nameId}
                          value={selectedList.name}
                          onChange={(e) => updateSelectedList({ name: e.target.value })}
                          className={`${fieldClass} min-w-40 flex-1 font-semibold`}
                          placeholder="List name"
                        />
                      </>
                    )}
                    {isAdmin && (
                      <div role="radiogroup" aria-label="Who can use the list" className={segmentGroupClass}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={!selectedList.isGlobal}
                          onClick={() => updateSelectedList({ isGlobal: false })}
                          className={segmentClass(!selectedList.isGlobal)}
                        >
                          <User className="h-3.5 w-3.5" />
                          User
                        </button>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={!!selectedList.isGlobal}
                          onClick={() => updateSelectedList({ isGlobal: true })}
                          className={segmentClass(!!selectedList.isGlobal)}
                        >
                          <Globe className="h-3.5 w-3.5" />
                          Global
                        </button>
                      </div>
                    )}
                  </div>
                  {isReadOnly ? (
                    selectedList.description ? (
                      <p className="text-[13px] leading-relaxed text-muted-foreground">
                        {selectedList.description}
                      </p>
                    ) : null
                  ) : (
                    <>
                      <label htmlFor={descId} className="sr-only">Description</label>
                      <input
                        id={descId}
                        value={selectedList.description}
                        onChange={(e) => updateSelectedList({ description: e.target.value })}
                        className={`${fieldClass} text-[13px]`}
                        placeholder="Description (optional)"
                      />
                    </>
                  )}
                  {isReadOnly && (
                    <div>
                      <Badge tone="muted">
                        <Globe className="h-3 w-3" aria-hidden="true" />
                        Global list — view only
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Add rule area */}
                {!isReadOnly && <div className="shrink-0 border-b border-border bg-secondary/40 px-5 py-4">
                  <h4 className="mb-3 text-[13px] font-semibold text-foreground">
                    Add Rule
                  </h4>

                  {/* Type toggle */}
                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span id={typeLabelId} className={`${labelClass} w-10 shrink-0`}>
                      Type
                    </span>
                    <div role="radiogroup" aria-labelledby={typeLabelId} className={segmentGroupClass}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={ruleType === "prefix"}
                        onClick={() => switchType("prefix")}
                        className={segmentClass(ruleType === "prefix")}
                      >
                        PREFIX
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={ruleType === "exact"}
                        onClick={() => switchType("exact")}
                        className={segmentClass(ruleType === "exact")}
                      >
                        EXACT
                      </button>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {ruleType === "prefix"
                        ? "protects any param whose name starts with this"
                        : "protects only this exact parameter name"}
                    </span>
                  </div>

                  {/* Autocomplete input */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <label htmlFor={ruleInputId} className={`${labelClass} w-10 shrink-0`}>
                      Value
                    </label>
                    <div className="relative min-w-48 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="relative min-w-0 flex-1">
                          <input
                            id={ruleInputId}
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
                            className={`${fieldClass} w-full pr-7 font-mono text-[13px]`}
                          />
                          {ruleInput && (
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setRuleInput("");
                                setShowSuggestions(false);
                                setSuggestionIdx(-1);
                                inputRef.current?.focus();
                              }}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                              aria-label="Clear input"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {ruleType === "exact" && (
                          <>
                            <label htmlFor={modeId} className="sr-only">Suggest by</label>
                            <select
                              id={modeId}
                              value={suggestionMode}
                              onChange={(e) =>
                                setSuggestionMode(e.target.value as SuggestionMode)
                              }
                              className={`${fieldClass} shrink-0 text-[13px] cursor-pointer`}
                            >
                              <option value="name">Name</option>
                              <option value="description">Description</option>
                              <option value="both">Both</option>
                            </select>
                          </>
                        )}
                      </div>

                      {/* Suggestions dropdown */}
                      {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
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
                                type="button"
                                key={s}
                                onMouseDown={() => addRule(s)}
                                className={cn(
                                  "flex w-full flex-col items-start rounded-md px-2.5 py-1.5 text-left text-[13px] text-foreground transition-colors cursor-pointer",
                                  i === suggestionIdx
                                    ? "bg-primary/15"
                                    : "hover:bg-secondary"
                                )}
                              >
                                <span className="font-mono">
                                  {nameMatches ? highlightText(s, q) : s}
                                </span>
                                {snippet && (
                                  <span className="mt-0.5 font-sans text-[10px] text-muted-foreground leading-snug">
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
                      type="button"
                      onClick={() => addRule(ruleInput)}
                      disabled={!ruleInput.trim()}
                      className={buttonClass("secondary", "md")}
                    >
                      <Plus className="h-4 w-4" />
                      Add
                    </button>
                  </div>
                </div>}

                {/* Rules list */}
                <div className="px-5 py-4 md:min-h-0 md:flex-1 md:overflow-y-auto">
                  {selectedList.rules.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center py-6 text-center">
                      <Shield className="mb-3 h-10 w-10 text-muted-foreground/30" />
                      <p className="text-sm font-medium text-foreground">
                        No rules yet
                      </p>
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        Add prefix or exact rules above to protect parameters
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {prefixRules.length > 0 && (
                        <div>
                          <p className="mb-2.5 text-[13px] font-medium text-foreground">
                            Prefix rules
                            <span className="ml-1 font-normal text-muted-foreground">
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
                                    "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-xs text-foreground transition-colors",
                                    isSelected
                                      ? "border-primary/50 bg-primary/15"
                                      : "border-border bg-secondary/60"
                                  )}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedRule(
                                        isSelected
                                          ? null
                                          : { type: "prefix", value: rule.value }
                                      )
                                    }
                                    className="flex h-full items-center gap-1.5 cursor-pointer"
                                  >
                                    <span
                                      className={cn(
                                        "text-[11px]",
                                        isSelected
                                          ? "text-primary"
                                          : "text-muted-foreground"
                                      )}
                                    >
                                      pre:
                                    </span>
                                    {rule.value}
                                  </button>
                                  {!isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() => removeRule(origIdx)}
                                      className="-mr-1 rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive cursor-pointer"
                                      aria-label={`Remove rule ${rule.value}`}
                                      title={`Remove rule ${rule.value}`}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {exactRules.length > 0 && (
                        <div>
                          <p className="mb-2.5 text-[13px] font-medium text-foreground">
                            Exact rules
                            <span className="ml-1 font-normal text-muted-foreground">
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
                                    "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-xs text-foreground transition-colors",
                                    isSelected
                                      ? "border-primary/50 bg-primary/15"
                                      : "border-blue-500/30 bg-blue-500/10"
                                  )}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedRule(
                                        isSelected
                                          ? null
                                          : { type: "exact", value: rule.value }
                                      )
                                    }
                                    className="flex h-full items-center gap-1.5 cursor-pointer"
                                  >
                                    <span
                                      className={cn(
                                        "text-[11px]",
                                        isSelected
                                          ? "text-primary"
                                          : "text-blue-700 dark:text-blue-400"
                                      )}
                                    >
                                      ex:
                                    </span>
                                    {rule.value}
                                  </button>
                                  {!isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() => removeRule(origIdx)}
                                      className="-mr-1 rounded p-0.5 text-muted-foreground transition-colors hover:text-destructive cursor-pointer"
                                      aria-label={`Remove rule ${rule.value}`}
                                      title={`Remove rule ${rule.value}`}
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
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
              <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-10 text-center">
                <Shield className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  Select a list to edit
                </p>
              </div>
            )}
          </div>

          {/* ── Info panel (right) ── */}
          <div className="flex shrink-0 flex-col md:w-64">
            <div className="px-4 pb-1 pt-3">
              <h3 className={columnTitleClass}>
                Parameter Info
              </h3>
            </div>

            <div className="max-h-72 overflow-y-auto md:max-h-none md:min-h-0 md:flex-1">
              {!selectedRule ? (
                <div className="flex h-full items-center justify-center px-4 py-6 text-center">
                  <p className="text-[13px] text-muted-foreground">
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
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-secondary/40 px-5 py-3">
          <p className="text-[13px] text-muted-foreground">
            {selectedList
              ? `${selectedList.rules.length} rule${selectedList.rules.length !== 1 ? "s" : ""} in this list`
              : ""}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className={buttonClass("secondary")}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={buttonClass("primary")}
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
    <span className="text-xs font-medium text-muted-foreground">
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
    <div className="flex flex-col gap-3 px-4 pb-4 pt-2">
      <div>
        <p className="break-all font-mono text-sm font-semibold text-foreground">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Exact match</p>
      </div>

      {def.DisplayName && (
        <div className="flex flex-col gap-0.5">
          <InfoLabel>Label</InfoLabel>
          <p className="text-[13px] text-foreground">{def.DisplayName}</p>
        </div>
      )}

      {def.Description && (
        <div className="flex flex-col gap-0.5">
          <InfoLabel>Description</InfoLabel>
          <p className="text-[13px] leading-relaxed text-foreground">
            {def.Description}
          </p>
        </div>
      )}

      {def.Units && (
        <div className="flex flex-col gap-0.5">
          <InfoLabel>Units</InfoLabel>
          <p className="text-[13px] text-foreground">{def.Units}</p>
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
        <div className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-300">
          <Power className="h-3.5 w-3.5 shrink-0" />
          Reboot required after change
        </div>
      )}

      {!hasInfo && (
        <p className="text-xs italic text-muted-foreground">
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
    <div className="flex flex-col md:h-full">
      <div className="shrink-0 border-b border-border px-4 pb-4 pt-2">
        <p className="break-all font-mono text-sm font-semibold text-foreground">
          {value}
          <span className="text-muted-foreground">*</span>
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Prefix — {matches.length} matching param{matches.length !== 1 ? "s" : ""}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          ArduPilot does not publish group-level descriptions. Showing matched
          params from the official database.
        </p>
      </div>

      <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
        {matches.length === 0 ? (
          <p className="p-4 text-xs italic text-muted-foreground">
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
                  <p className="mt-0.5 text-xs text-muted-foreground">
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
