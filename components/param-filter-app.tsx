"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import Link from "next/link";
import { FileText, FilePlus, ArrowLeft, ArrowRight, Download, BookmarkPlus, X, User, Library, LogOut, Upload, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/components/auth-provider";
import { writeParamFile } from "@/lib/param-engine";
import { FileUpload } from "@/components/file-upload";
import { ProtectionListSelect } from "@/components/protection-list-select";
import { ParamPanel } from "@/components/param-panel";
import { DetailPanel } from "@/components/detail-panel";
import { ConsolePanel } from "@/components/console-panel";
import { ListEditorDialog } from "@/components/list-editor-dialog";
import { SaveResumeModal } from "@/components/save-resume-modal";

// ---------- flying rows portal ----------

const MAX_FLYING = 8;

interface FlyingRow {
  id: string;
  name: string;
  fromRect: DOMRect;
  toX: number;
  toY: number;
  delay: number;
  variant: "protected" | "applied";
}

function FlyingRowsOverlay({ rows }: { rows: FlyingRow[] }) {
  if (rows.length === 0) return null;
  return createPortal(
    <>
      {rows.map((row) => (
        <motion.div
          key={row.id}
          style={{ position: "fixed", top: 0, left: 0, pointerEvents: "none", zIndex: 9999,
            width: Math.min(row.fromRect.width * 0.6, 240) }}
          initial={{ x: row.fromRect.left, y: row.fromRect.top, opacity: 0.9 }}
          animate={{ x: row.toX, y: row.toY, opacity: 0 }}
          transition={{ duration: 0.35, delay: row.delay, ease: "easeInOut" }}
        >
          <div className={cn(
            "flex items-center px-3 rounded border font-mono text-xs truncate",
            "h-6.5",
            row.variant === "protected"
              ? "bg-protected/40 border-red-400/50 text-red-300"
              : "bg-secondary border-border text-foreground/90"
          )}>
            {row.name}
          </div>
        </motion.div>
      ))}
    </>,
    document.body
  );
}

export function ParamFilterApp() {
  const {
    fileName,
    protectedParams,
    remainingParams,
    checkedProtected,
    checkedRemaining,
    pdefGroups,
    paramDefs,
    cacheAge,
    defsLoading,
    statusMessage,
    toggleCheckedProtected,
    toggleCheckedRemaining,
    toggleAllProtected,
    toggleAllRemaining,
    toggleGroupProtected,
    toggleGroupRemaining,
    moveCheckedToProtected,
    moveCheckedToRemaining,
    selectParam,
    setParamDefs,
    setDefsLoading,
    protectionLists,
    setProtectionLists,
    activeListName,
    isProtectionModified,
    createFromDefs,
    log,
  } = useApp();

  const { user, role, signOut } = useAuth();

  const [appMode, setAppMode] = useState<"idle" | "edit" | "create">("idle");
  const [editorOpen, setEditorOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<"protected" | "applied">("applied");
const [saveResumeOpen, setSaveResumeOpen] = useState(false);
  const [remainingOverrides, setRemainingOverrides] = useState<Map<string, string>>(new Map());
  const [flyingRows, setFlyingRows] = useState<FlyingRow[]>([]);

  const protectedPanelRef = useRef<HTMLDivElement>(null);
  const appliedPanelRef = useRef<HTMLDivElement>(null);

  const handleRemainingOverride = useCallback((name: string, value: string) => {
    setRemainingOverrides((prev) => {
      const next = new Map(prev);
      if (value === "") next.delete(name);
      else next.set(name, value);
      return next;
    });
  }, []);

  const handleMoveToApplied = useCallback(() => {
    if (checkedProtected.size === 0) return;
    const srcEl = protectedPanelRef.current;
    const dstEl = appliedPanelRef.current;
    if (srcEl && dstEl) {
      const dstRect = dstEl.getBoundingClientRect();
      const toX = dstRect.left + 20;
      const rows: FlyingRow[] = [];
      let i = 0;
      for (const name of checkedProtected) {
        if (i >= MAX_FLYING) break;
        const el = srcEl.querySelector(`[data-param="${name}"]`);
        if (el) {
          rows.push({ id: `${name}-${Date.now()}`, name, fromRect: el.getBoundingClientRect(),
            toX, toY: dstRect.top + 100 + i * 6, delay: i * 0.04, variant: "protected" });
          i++;
        }
      }
      if (rows.length > 0) {
        setFlyingRows(rows);
        const ttl = (0.35 + (rows.length - 1) * 0.04 + 0.1) * 1000;
        setTimeout(() => setFlyingRows([]), ttl);
      }
    }
    moveCheckedToRemaining();
  }, [checkedProtected, moveCheckedToRemaining]);

  const handleMoveToProtected = useCallback(() => {
    if (checkedRemaining.size === 0) return;
    const srcEl = appliedPanelRef.current;
    const dstEl = protectedPanelRef.current;
    if (srcEl && dstEl) {
      const dstRect = dstEl.getBoundingClientRect();
      const toX = dstRect.right - 260;
      const rows: FlyingRow[] = [];
      let i = 0;
      for (const name of checkedRemaining) {
        if (i >= MAX_FLYING) break;
        const el = srcEl.querySelector(`[data-param="${name}"]`);
        if (el) {
          rows.push({ id: `${name}-${Date.now()}`, name, fromRect: el.getBoundingClientRect(),
            toX, toY: dstRect.top + 100 + i * 6, delay: i * 0.04, variant: "applied" });
          i++;
        }
      }
      if (rows.length > 0) {
        setFlyingRows(rows);
        const ttl = (0.35 + (rows.length - 1) * 0.04 + 0.1) * 1000;
        setTimeout(() => setFlyingRows([]), ttl);
      }
    }
    moveCheckedToProtected();
  }, [checkedRemaining, moveCheckedToProtected]);

  const handleCreateNew = useCallback(() => {
    if (!Object.keys(paramDefs).length) {
      log("Definitions not loaded yet, please wait...", "WARN");
      return;
    }
    createFromDefs();
    setAppMode("create");
    setRemainingOverrides(new Map());
  }, [paramDefs, createFromDefs, log]);

  // Info sidebar resize (horizontal)
  const [infoWidth, setInfoWidth] = useState(288);
  const infoDrag = useRef<{ startX: number; startWidth: number } | null>(null);

  const handleInfoDragStart = useCallback((e: React.MouseEvent) => {
    infoDrag.current = { startX: e.clientX, startWidth: infoWidth };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  }, [infoWidth]);

  // Console panel resize (vertical)
  const [consoleHeight, setConsoleHeight] = useState(140);
  const consoleDrag = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleConsoleDragStart = useCallback((e: React.MouseEvent) => {
    consoleDrag.current = { startY: e.clientY, startHeight: consoleHeight };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  }, [consoleHeight]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (infoDrag.current) {
        const delta = infoDrag.current.startX - e.clientX;
        setInfoWidth(Math.max(180, Math.min(560, infoDrag.current.startWidth + delta)));
      }
      if (consoleDrag.current) {
        const delta = consoleDrag.current.startY - e.clientY;
        setConsoleHeight(Math.max(60, Math.min(400, consoleDrag.current.startHeight + delta)));
      }
    };
    const onUp = () => {
      if (infoDrag.current) {
        infoDrag.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
      if (consoleDrag.current) {
        consoleDrag.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // "Save selection as list" dialog state
  const [saveListOpen, setSaveListOpen] = useState(false);
  const [saveListName, setSaveListName] = useState("");
  const [saveListDesc, setSaveListDesc] = useState("");
  const saveListInputRef = useRef<HTMLInputElement>(null);

  const openSaveList = useCallback(() => {
    setSaveListName("");
    setSaveListDesc("");
    setSaveListOpen(true);
    setTimeout(() => saveListInputRef.current?.focus(), 50);
  }, []);

  const handleSaveList = useCallback(() => {
    if (!saveListName.trim() || protectedParams.length === 0) return;
    const rules = protectedParams.map((p) => ({
      type: "exact" as const,
      value: p.name,
    }));
    setProtectionLists([
      ...protectionLists,
      { name: saveListName.trim(), description: saveListDesc.trim(), rules },
    ]);
    log(
      `Created protection list '${saveListName.trim()}' with ${rules.length} rule(s)`
    );
    setSaveListOpen(false);
  }, [saveListName, saveListDesc, protectedParams, protectionLists, setProtectionLists, log]);

  // Load param definitions on mount
  useEffect(() => {
    async function loadDefs() {
      setDefsLoading(true);
      try {
        const res = await fetch("/api/param-definitions");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const age = data.fetchedAt
          ? formatAge(Date.now() - data.fetchedAt)
          : "just now";
        setParamDefs(data.params, data.groups, age);
        log(
          `Definitions loaded \u2014 ${Object.keys(data.params).length} params, ${data.groups.length} groups`
        );
      } catch (err) {
        log(`Could not load definitions: ${(err as Error).message}`, "WARN");
      } finally {
        setDefsLoading(false);
      }
    }
    loadDefs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

const handleSave = useCallback(() => {
    if (remainingParams.length === 0) return;
    setSaveResumeOpen(true);
  }, [remainingParams]);

  const handleConfirmSave = useCallback((header: string | null) => {
    const merged = remainingParams.map((p) => ({
      ...p,
      value: remainingOverrides.get(p.name) || p.value,
    }));
    const content = (header ?? "") + writeParamFile(merged);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = fileName ? fileName.replace(/\.\w+$/, "") : "params";
    const outName = appMode === "create"
      ? "new_config.param"
      : `${baseName}_filtered.param`;
    a.href = url;
    a.download = outName;
    a.click();
    URL.revokeObjectURL(url);
    log(
      `Saved '${outName}' \u2014 ${merged.length} written${appMode !== "create" ? `, ${protectedParams.length} removed` : ""}`
    );
  }, [appMode, protectedParams, remainingParams, remainingOverrides, fileName, log]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Toolbar */}
      <header className={cn(
        "flex items-center gap-3 border-b border-border px-4 py-2.5 shrink-0 transition-colors duration-300",
        appMode === "create" ? "bg-emerald-950/25 border-b-emerald-800/50" : "bg-toolbar"
      )}>
        {/* Left: file operations */}
        <FileUpload onFileLoaded={() => { setAppMode("edit"); setRemainingOverrides(new Map()); }} />
        {appMode === "edit" && fileName && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            <span className="font-mono font-medium text-foreground">{fileName}</span>
          </div>
        )}

        <div className="w-px h-5 bg-border shrink-0" />

        <button
          onClick={handleCreateNew}
          disabled={defsLoading}
          title="Browse all ArduPilot params — values will be 0 (pdef.json has no defaults)"
          className={cn(
            "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors cursor-pointer",
            appMode === "create"
              ? "bg-emerald-600 hover:bg-emerald-500 text-white"
              : "bg-emerald-800/70 hover:bg-emerald-700 text-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          <FilePlus className="h-4 w-4" />
          New Config
        </button>
        {appMode === "create" && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-900/50 text-emerald-300 border border-emerald-700/60"
            title="Values are 0 — ArduPilot pdef.json does not publish firmware defaults"
          >
            <FilePlus className="h-3 w-3" />
            values are 0
          </div>
        )}

        <Link
          href="/catalog"
          className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
        >
          <Library className="h-4 w-4" />
          Catalog
        </Link>
        {(role === "contributor" || role === "admin") && (
          <Link
            href="/upload"
            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
          >
            <Upload className="h-4 w-4" />
            Upload
          </Link>
        )}
        {role === "admin" && (
          <Link
            href="/admin"
            className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
          >
            <Settings className="h-4 w-4" />
            Admin
          </Link>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: list selector + user */}
        <ProtectionListSelect onEditLists={() => setEditorOpen(true)} />
        {user ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-l border-border pl-3">
            <User className="h-3.5 w-3.5" />
            <span className="font-mono font-medium text-foreground">{user.email}</span>
            <button
              onClick={signOut}
              className="hover:text-foreground transition-colors cursor-pointer flex items-center gap-1"
              title="Sign out"
            >
              <LogOut className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer border-l border-border pl-3"
          >
            Sign in
          </Link>
        )}
      </header>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">

        {/* ── Transfer zone: Protected ⟵⟶ Applied ── */}
        <div className="flex flex-1 min-w-0 min-h-0">

        {/* Protected panel */}
        <div ref={protectedPanelRef} className="flex flex-col flex-1 min-w-0 p-2" onMouseEnter={() => setActivePanel("protected")}>
          <ParamPanel
            title="PROTECTED — will be removed"
            headerColor="bg-protected-header"
            variant="protected"
            isActive={activePanel === "protected"}
            params={protectedParams}
            checkedNames={checkedProtected}
            pdefGroups={pdefGroups}
            onToggleCheck={toggleCheckedProtected}
            onToggleAll={toggleAllProtected}
            onToggleGroup={toggleGroupProtected}
            onSelectParam={selectParam}
            headerAction={
              <div className="flex items-center gap-1.5">
                <span
                  className="text-xs text-foreground/70 font-mono truncate max-w-30"
                  title={activeListName}
                >
                  {activeListName}
                </span>
                {isProtectionModified && (
                  <button
                    onClick={openSaveList}
                    className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-foreground/80 hover:bg-black/20 transition-colors whitespace-nowrap cursor-pointer"
                    title="Save the current protected params as a new protection list"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    Save as list
                  </button>
                )}
              </div>
            }
          />
        </div>

        {/* Center: Move buttons */}
        <div className="flex flex-col items-center justify-center gap-3 px-1 py-4 shrink-0">
          <button
            onClick={handleMoveToProtected}
            disabled={checkedRemaining.size === 0}
            className={cn(
              "flex w-16 flex-col items-center justify-center rounded-lg py-3 text-xs font-bold transition-colors",
              "bg-protected-header text-foreground hover:bg-[#8b3a3a] disabled:opacity-30 disabled:cursor-not-allowed"
            )}
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="mt-0.5">Protect</span>
          </button>
          <button
            onClick={handleMoveToApplied}
            disabled={checkedProtected.size === 0}
            className={cn(
              "flex w-16 flex-col items-center justify-center rounded-lg py-3 text-xs font-bold transition-colors",
              "bg-applied-header text-foreground hover:bg-[#3a7232] disabled:opacity-30 disabled:cursor-not-allowed"
            )}
          >
            <span className="mb-0.5">Apply</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        {/* Applied panel */}
        <div ref={appliedPanelRef} className="flex flex-col flex-1 min-w-0 p-2" onMouseEnter={() => setActivePanel("applied")}>
          <ParamPanel
            title={appMode === "create" ? "DEFAULT VALUES" : "WILL BE APPLIED"}
            headerColor={appMode === "create" ? "bg-emerald-900/40" : "bg-applied-header"}
            variant="applied"
            isActive={activePanel === "applied"}
            params={remainingParams}
            checkedNames={checkedRemaining}
            pdefGroups={pdefGroups}
            onToggleCheck={toggleCheckedRemaining}
            onToggleAll={toggleAllRemaining}
            onToggleGroup={toggleGroupRemaining}
            onSelectParam={selectParam}
            valueOverrides={remainingOverrides}
            onOverrideValue={handleRemainingOverride}
          />
        </div>

        </div>{/* end transfer zone */}

        {/* ── Info sidebar (read-only, resizable) ── */}
        <div
          className="hidden lg:flex lg:flex-col shrink-0 bg-card/40 relative"
          style={{ width: infoWidth }}
        >
          {/* Drag handle */}
          <div
            onMouseDown={handleInfoDragStart}
            className="absolute left-0 top-0 bottom-0 w-1 bg-border hover:bg-primary/60 transition-colors cursor-col-resize z-10"
          />
          <div className="pl-4 pr-3 py-2 border-b border-border bg-toolbar">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground">
              Parameter Info
            </span>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <DetailPanel />
          </div>
        </div>

      </div>

      {/* Bottom: Console + Status bar */}
      <div className="flex flex-col shrink-0 relative">
        {/* Drag handle */}
        <div
          onMouseDown={handleConsoleDragStart}
          className="h-1 bg-border hover:bg-primary/60 transition-colors cursor-row-resize shrink-0"
        />
        <div style={{ height: consoleHeight }}>
          <ConsolePanel />
        </div>
        <div className="flex items-center justify-between border-t border-border bg-toolbar px-4 py-1.5">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={remainingParams.length === 0}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors",
                "bg-primary hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed"
              )}
            >
              <Download className="h-3.5 w-3.5" />
              {appMode === "create" ? "Save New File" : "Save Filtered File"}
            </button>
            <span className="text-xs text-muted-foreground">
              {statusMessage}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Cache: {defsLoading ? "loading..." : cacheAge}
          </span>
        </div>
      </div>

      {/* Flying rows overlay */}
      <FlyingRowsOverlay rows={flyingRows} />

      {/* List Editor Dialog */}
      {editorOpen && (
        <ListEditorDialog onClose={() => setEditorOpen(false)} />
      )}

      {/* Save resume modal */}
      {saveResumeOpen && (
        <SaveResumeModal
          protectedParams={protectedParams}
          remainingParams={remainingParams}
          remainingOverrides={remainingOverrides}
          fileName={fileName}
          onConfirm={handleConfirmSave}
          onClose={() => setSaveResumeOpen(false)}
        />
      )}

      {/* Save selection as list dialog */}
      {saveListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5">
              <div className="flex items-center gap-2">
                <BookmarkPlus className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">
                  Save Selection as Protection List
                </h2>
              </div>
              <button
                onClick={() => setSaveListOpen(false)}
                className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Name
                </label>
                <input
                  ref={saveListInputRef}
                  type="text"
                  value={saveListName}
                  onChange={(e) => setSaveListName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveList()}
                  placeholder="e.g. Battery Parameters"
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Description{" "}
                  <span className="normal-case text-muted-foreground/60 font-normal">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={saveListDesc}
                  onChange={(e) => setSaveListDesc(e.target.value)}
                  placeholder="A short description"
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Preview of rules */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {protectedParams.length} exact rule
                  {protectedParams.length !== 1 ? "s" : ""} will be created
                </label>
                <div className="rounded-md border border-border bg-background/50 px-3 py-2 max-h-36 overflow-y-auto">
                  {protectedParams.slice(0, 8).map((p) => (
                    <p key={p.name} className="font-mono text-xs text-foreground py-0.5">
                      <span className="text-muted-foreground/60 mr-1.5">ex:</span>
                      {p.name}
                    </p>
                  ))}
                  {protectedParams.length > 8 && (
                    <p className="text-xs text-muted-foreground italic pt-1">
                      …and {protectedParams.length - 8} more
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-border bg-toolbar px-5 py-3">
              <button
                onClick={() => setSaveListOpen(false)}
                className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveList}
                disabled={!saveListName.trim()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-30"
              >
                Create List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatAge(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m ago`;
}
