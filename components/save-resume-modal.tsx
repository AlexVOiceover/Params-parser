"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Lock, Download, X, Shield, ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import type { Param } from "@/lib/types";

// ---------- helpers ----------

type ParamGroup = { prefix: string; params: Param[] };
type ParamItem = { type: "group"; group: ParamGroup } | { type: "solo"; param: Param };

function buildPrefixItems(params: Param[]): ParamItem[] {
  const map = new Map<string, Param[]>();
  for (const p of params) {
    const prefix = p.name.includes("_") ? p.name.split("_")[0] : "__solo__";
    if (!map.has(prefix)) map.set(prefix, []);
    map.get(prefix)!.push(p);
  }
  const items: ParamItem[] = [];
  for (const [prefix, group] of map) {
    if (prefix !== "__solo__" && group.length >= 3) {
      items.push({ type: "group", group: { prefix, params: group } });
    } else {
      for (const p of group) items.push({ type: "solo", param: p });
    }
  }
  return items;
}

// ---------- useLongPress hook ----------

function useLongPress(onLongPress: () => void, duration = 2000) {
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);
  const callbackRef = useRef(onLongPress);
  callbackRef.current = onLongPress;

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const start = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    completedRef.current = false;
    setPressing(true);
    timerRef.current = setTimeout(() => {
      completedRef.current = true;
      callbackRef.current();
      setPressing(false);
    }, duration);
  }, [duration]);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPressing(false);
  }, []);

  return {
    pressing,
    completedRef,
    handlers: {
      onMouseDown: start,
      onMouseUp: cancel,
      onMouseLeave: cancel,
      onTouchStart: start,
      onTouchEnd: cancel,
      onTouchCancel: cancel,
    },
  };
}

// ---------- column layout ----------

const COL_ICON   = "w-8 shrink-0";
const COL_NAME   = "flex-1 min-w-0 font-mono text-xs";
const COL_VALUE  = "w-24 shrink-0 font-mono text-xs text-right tabular-nums";
const COL_STATUS = "w-20 shrink-0";

const ROW_TRANSITION = { duration: 0.18 };
const ROW_INITIAL    = { opacity: 0, y: -5 };
const ROW_ANIMATE    = { opacity: 1, y: 0 };
const ROW_EXIT       = { opacity: 0 };

// ---------- StatusCell ----------

function StatusCell({
  paramName,
  isProtected,
}: {
  paramName: string;
  isProtected: boolean;
}) {
  const { moveSingleToProtected, moveSingleToRemaining } = useApp();

  const singleMove = useCallback(() => {
    if (isProtected) moveSingleToRemaining(paramName);
    else moveSingleToProtected(paramName);
  }, [isProtected, paramName, moveSingleToProtected, moveSingleToRemaining]);

  const lp = useLongPress(singleMove);

  const fillBg = isProtected ? "rgba(134,239,172,0.18)" : "rgba(252,165,165,0.18)";
  const label = isProtected ? "Skipped" : "Write";
  const hintLabel = isProtected ? "→ Write" : "→ Protect";

  return (
    <div
      className={cn(
        COL_STATUS,
        "px-4 py-1 relative overflow-hidden select-none cursor-pointer",
        isProtected ? "hover:bg-applied/10" : "hover:bg-protected/10"
      )}
      title={`Hold 2s to ${isProtected ? "move to Write" : "move to Protected"}`}
      {...lp.handlers}
    >
      {lp.pressing && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ animation: "longPressFill 2s linear forwards", transformOrigin: "left center", background: fillBg }}
        />
      )}
      <span
        className={cn(
          "relative text-[11px] transition-opacity",
          isProtected ? "text-red-400/70" : "text-applied-text/80",
          lp.pressing && "opacity-40"
        )}
      >
        {lp.pressing ? hintLabel : label}
      </span>
    </div>
  );
}

// ---------- PrefixGroupRows ----------

function PrefixGroupRows({
  group,
  variant,
}: {
  group: ParamGroup;
  variant: "protected" | "applied";
}) {
  const { moveBulkToProtected, moveBulkToRemaining } = useApp();
  const [open, setOpen] = useState(true);
  const isProtected = variant === "protected";

  const names = group.params.map((p) => p.name);
  const bulkMove = useCallback(() => {
    if (isProtected) moveBulkToRemaining(names);
    else moveBulkToProtected(names);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProtected, moveBulkToProtected, moveBulkToRemaining]);

  const lp = useLongPress(bulkMove);

  const fillBg = isProtected ? "rgba(134,239,172,0.15)" : "rgba(252,165,165,0.15)";
  const hintText = isProtected
    ? `→ Write all (${group.params.length})`
    : `→ Protect all (${group.params.length})`;

  return (
    <div>
      {/* Group header */}
      <div
        className="relative overflow-hidden bg-secondary/50 border-b border-border/60"
        title={`Hold 2s to ${isProtected ? "move all to Write" : "move all to Protected"}`}
      >
        {lp.pressing && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ animation: "longPressFill 2s linear forwards", transformOrigin: "left center", background: fillBg }}
          />
        )}
        <button
          onClick={() => { if (!lp.completedRef.current) setOpen((v) => !v); }}
          {...lp.handlers}
          className="relative flex w-full items-center gap-1.5 px-4 py-1 text-left cursor-pointer hover:bg-secondary/70 transition-colors select-none"
        >
          {open ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
          {lp.pressing ? (
            <span
              className={cn(
                "font-mono text-[11px] font-semibold",
                isProtected ? "text-applied-text" : "text-protected-text"
              )}
            >
              {hintText}
            </span>
          ) : (
            <>
              <span className="font-mono text-[11px] font-semibold text-group-text">
                {group.prefix}_*
              </span>
              <span className="ml-1 text-[10px] text-muted-foreground tabular-nums">
                ({group.params.length})
              </span>
            </>
          )}
        </button>
      </div>

      {/* Child rows */}
      <AnimatePresence initial={false}>
        {open &&
          group.params.map((p) => (
            <motion.div
              key={p.name}
              initial={ROW_INITIAL}
              animate={ROW_ANIMATE}
              exit={ROW_EXIT}
              transition={ROW_TRANSITION}
              className={cn(
                "flex items-center border-b border-border/30",
                isProtected
                  ? "bg-protected/5 hover:bg-protected/12"
                  : "bg-secondary/10 hover:bg-secondary/20"
              )}
            >
              <div
                className={cn(
                  COL_ICON,
                  "py-1 flex items-center justify-center border-l-4",
                  isProtected ? "border-red-400/35" : "border-group-text/30"
                )}
              >
                {isProtected && <Lock className="h-3 w-3 text-red-400/70" />}
              </div>
              <div className={cn(COL_NAME, "py-1 pl-4 pr-2")}>
                <span className={isProtected ? "text-red-400" : "text-foreground"}>
                  {p.name}
                </span>
              </div>
              <div
                className={cn(
                  COL_VALUE,
                  "py-1 px-4",
                  isProtected ? "text-red-400/60" : "text-muted-foreground"
                )}
              >
                {p.value}
              </div>
              <StatusCell paramName={p.name} isProtected={isProtected} />
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}

// ---------- main component ----------

interface SaveResumeModalProps {
  protectedParams: Param[];
  remainingParams: Param[];
  fileName: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function SaveResumeModal({
  protectedParams,
  remainingParams,
  fileName,
  onConfirm,
  onClose,
}: SaveResumeModalProps) {
  const baseName = fileName ? fileName.replace(/\.\w+$/, "") : "params";
  const [protectedOpen, setProtectedOpen] = useState(true);
  const [appliedOpen, setAppliedOpen] = useState(true);

  const protectedItems = useMemo(() => buildPrefixItems(protectedParams), [protectedParams]);
  const appliedItems = useMemo(() => buildPrefixItems(remainingParams), [remainingParams]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 flex flex-col w-full max-w-2xl max-h-[85vh] rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">
              Save Summary — {baseName}_filtered.param
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Sticky column header */}
          <div className="sticky top-0 z-10 flex items-center border-b border-border bg-toolbar text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <div className={cn(COL_ICON, "py-2")} />
            <div className={cn(COL_NAME, "py-2 pl-2")}>Parameter</div>
            <div className={cn(COL_VALUE, "py-2 px-4")}>Value</div>
            <div className={cn(COL_STATUS, "py-2 px-4")}>Status</div>
          </div>

          <div>
            {/* ── Protected section ── */}
            {protectedParams.length > 0 && (
              <div>
                <div className="bg-protected/20 border-y border-border">
                  <button
                    onClick={() => setProtectedOpen((v) => !v)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left cursor-pointer hover:bg-protected/30 transition-colors"
                  >
                    {protectedOpen ? (
                      <ChevronDown className="h-3 w-3 text-protected-text shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-protected-text shrink-0" />
                    )}
                    <Lock className="h-3 w-3 text-protected-text shrink-0" />
                    <span className="text-[10px] font-semibold text-protected-text uppercase tracking-wider">
                      Protected — will NOT be written ({protectedParams.length})
                    </span>
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {protectedOpen &&
                    protectedItems.map((item) =>
                      item.type === "group" ? (
                        <PrefixGroupRows
                          key={item.group.prefix}
                          group={item.group}
                          variant="protected"
                        />
                      ) : (
                        <motion.div
                          key={item.param.name}
                          initial={ROW_INITIAL}
                          animate={ROW_ANIMATE}
                          exit={ROW_EXIT}
                          transition={ROW_TRANSITION}
                          className="flex items-center border-b border-border/40 bg-protected/5 hover:bg-protected/15"
                        >
                          <div className={cn(COL_ICON, "py-1.5 flex items-center justify-center")}>
                            <Lock className="h-3 w-3 text-red-400" />
                          </div>
                          <div className={cn(COL_NAME, "px-2 py-1.5 font-medium text-red-400")}>
                            {item.param.name}
                          </div>
                          <div className={cn(COL_VALUE, "px-4 py-1.5 text-red-400/80")}>
                            {item.param.value}
                          </div>
                          <StatusCell paramName={item.param.name} isProtected={true} />
                        </motion.div>
                      )
                    )}
                </AnimatePresence>
              </div>
            )}

            {/* ── Applied section ── */}
            {remainingParams.length > 0 && (
              <div>
                <div className="bg-applied/20 border-y border-border">
                  <button
                    onClick={() => setAppliedOpen((v) => !v)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left cursor-pointer hover:bg-applied/30 transition-colors"
                  >
                    {appliedOpen ? (
                      <ChevronDown className="h-3 w-3 text-applied-text shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-applied-text shrink-0" />
                    )}
                    <Shield className="h-3 w-3 text-applied-text shrink-0" />
                    <span className="text-[10px] font-semibold text-applied-text uppercase tracking-wider">
                      Will be applied ({remainingParams.length})
                    </span>
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {appliedOpen &&
                    appliedItems.map((item) =>
                      item.type === "group" ? (
                        <PrefixGroupRows
                          key={item.group.prefix}
                          group={item.group}
                          variant="applied"
                        />
                      ) : (
                        <motion.div
                          key={item.param.name}
                          initial={ROW_INITIAL}
                          animate={ROW_ANIMATE}
                          exit={ROW_EXIT}
                          transition={ROW_TRANSITION}
                          className="flex items-center border-b border-border/40 hover:bg-secondary/30"
                        >
                          <div className={cn(COL_ICON, "py-1.5")} />
                          <div className={cn(COL_NAME, "px-2 py-1.5 font-medium text-foreground")}>
                            {item.param.name}
                          </div>
                          <div className={cn(COL_VALUE, "px-4 py-1.5 text-muted-foreground")}>
                            {item.param.value}
                          </div>
                          <StatusCell paramName={item.param.name} isProtected={false} />
                        </motion.div>
                      )
                    )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-toolbar px-5 py-3 shrink-0">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{remainingParams.length}</span> params
            written,{" "}
            <span className="font-semibold text-red-400">{protectedParams.length}</span> protected
            params removed
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => { onConfirm(); onClose(); }}
              className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              Download File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
