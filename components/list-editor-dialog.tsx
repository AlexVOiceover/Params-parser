"use client";

import { useState, useCallback } from "react";
import { X, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import type { ProtectionList, Rule } from "@/lib/types";

interface ListEditorDialogProps {
  onClose: () => void;
}

export function ListEditorDialog({ onClose }: ListEditorDialogProps) {
  const { protectionLists, setProtectionLists, log } = useApp();

  // Deep clone to work with local state
  const [lists, setLists] = useState<ProtectionList[]>(() =>
    JSON.parse(JSON.stringify(protectionLists))
  );
  const [selectedIdx, setSelectedIdx] = useState(lists.length > 0 ? 0 : -1);
  const [selectedRuleIdx, setSelectedRuleIdx] = useState(-1);

  // New rule form
  const [ruleType, setRuleType] = useState<"prefix" | "exact">("prefix");
  const [ruleValue, setRuleValue] = useState("");

  // New list form
  const [showNewList, setShowNewList] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");

  const selectedList = selectedIdx >= 0 ? lists[selectedIdx] : null;

  const handleSave = useCallback(() => {
    setProtectionLists(lists);
    log("Protection lists updated");
    onClose();
  }, [lists, setProtectionLists, log, onClose]);

  const handleAddRule = useCallback(() => {
    if (selectedIdx < 0 || !ruleValue.trim()) return;
    const updated = [...lists];
    updated[selectedIdx] = {
      ...updated[selectedIdx],
      rules: [...updated[selectedIdx].rules, { type: ruleType, value: ruleValue.trim() }],
    };
    setLists(updated);
    setRuleValue("");
  }, [selectedIdx, ruleType, ruleValue, lists]);

  const handleRemoveRule = useCallback(() => {
    if (selectedIdx < 0 || selectedRuleIdx < 0) return;
    const updated = [...lists];
    const rules = [...updated[selectedIdx].rules];
    rules.splice(selectedRuleIdx, 1);
    updated[selectedIdx] = { ...updated[selectedIdx], rules };
    setLists(updated);
    setSelectedRuleIdx(-1);
  }, [selectedIdx, selectedRuleIdx, lists]);

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
    setSelectedRuleIdx(-1);
  }, [selectedIdx, lists]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex w-full max-w-4xl h-[600px] flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-bold text-foreground">
            Edit Protection Lists
          </h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left sidebar: list names */}
          <div className="flex w-[200px] flex-col border-r border-border shrink-0">
            <div className="flex-1 overflow-y-auto p-2">
              {lists.map((pl, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedIdx(i);
                    setSelectedRuleIdx(-1);
                  }}
                  className={cn(
                    "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                    i === selectedIdx
                      ? "bg-primary/20 text-foreground font-medium"
                      : "text-secondary-foreground hover:bg-secondary"
                  )}
                >
                  {pl.name}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 border-t border-border p-2">
              <button
                onClick={() => setShowNewList(true)}
                className="flex-1 flex items-center justify-center gap-1 rounded-md bg-primary px-2 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                New List
              </button>
              <button
                onClick={handleDeleteList}
                disabled={selectedIdx < 0}
                className="flex items-center justify-center gap-1 rounded-md bg-destructive px-2.5 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/80 transition-colors disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Right: rules for selected list */}
          <div className="flex flex-1 flex-col min-w-0">
            {selectedList ? (
              <>
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-sm font-bold text-foreground">
                    {selectedList.name}
                  </h3>
                  {selectedList.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                      {selectedList.description}
                    </p>
                  )}
                </div>

                <div className="px-4 pt-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Rules (exact = full name match | prefix = starts with)
                  </span>
                </div>

                {/* Rules list */}
                <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
                  {selectedList.rules.length === 0 && (
                    <p className="py-4 text-center text-xs text-muted-foreground italic">
                      No rules defined yet
                    </p>
                  )}
                  {selectedList.rules.map((rule, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedRuleIdx(i)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-left transition-colors",
                        i === selectedRuleIdx
                          ? "bg-primary/20"
                          : "hover:bg-secondary/50"
                      )}
                    >
                      <span className="font-mono text-xs text-muted-foreground w-16 shrink-0">
                        [{rule.type}]
                      </span>
                      <span className="font-mono text-xs text-foreground truncate">
                        {rule.value}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Add rule controls */}
                <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      Type:
                    </span>
                    <select
                      value={ruleType}
                      onChange={(e) =>
                        setRuleType(e.target.value as "prefix" | "exact")
                      }
                      className="h-8 rounded-md border border-border bg-secondary px-2 text-xs text-foreground outline-none"
                    >
                      <option value="prefix">prefix</option>
                      <option value="exact">exact</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">
                      Value:
                    </span>
                    <input
                      type="text"
                      value={ruleValue}
                      onChange={(e) => setRuleValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddRule()}
                      placeholder="e.g. COMPASS_OFS"
                      className="h-8 rounded-md border border-border bg-secondary px-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring w-44"
                    />
                  </div>
                  <button
                    onClick={handleAddRule}
                    disabled={!ruleValue.trim()}
                    className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30"
                  >
                    + Add Rule
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={handleRemoveRule}
                    disabled={selectedRuleIdx < 0}
                    className="h-8 rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground hover:bg-destructive/80 transition-colors disabled:opacity-30"
                  >
                    Remove Selected
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center flex-1 text-sm text-muted-foreground">
                Select a list to edit
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
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

      {/* New List sub-dialog */}
      {showNewList && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/70">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-foreground mb-3">
              New Protection List
            </h3>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Name</label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleNewList()}
                  autoFocus
                  className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                  placeholder="e.g. Battery Parameters"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring"
                  placeholder="A short description"
                />
              </div>
              <div className="flex items-center justify-end gap-2 mt-1">
                <button
                  onClick={() => setShowNewList(false)}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleNewList}
                  disabled={!newListName.trim()}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
