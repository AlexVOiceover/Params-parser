"use client";

import { useEffect, useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import Link from "next/link";
import { FileText, FilePlus, FolderOpen, Filter, ArrowLeft, ArrowRight, Download, BookmarkPlus, X, Library, Usb, ChevronRight } from "lucide-react";
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
import { CatalogUploadModal } from "@/components/catalog-upload-modal";
import { useDroneParams } from "@/lib/drone-params-context";
import { Badge } from "@/components/status-badge";
import { buttonClass, cardClass, fieldClass, labelClass, pageLeadClass, pageTitleClass } from "@/components/ui/styles";

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
            "flex items-center px-3 rounded-md border font-mono text-xs truncate shadow-sm",
            "h-6.5",
            row.variant === "protected"
              ? "bg-protected border-red-500/40 text-protected-text"
              : "bg-card border-border text-foreground"
          )}>
            {row.name}
          </div>
        </motion.div>
      ))}
    </>,
    document.body
  );
}

export function ParamFilterApp({ loadUrl, catalogSource }: { loadUrl?: string; catalogSource?: { family: string; variant: string; client: string; version: string } }) {
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
    loadFile,
    log,
  } = useApp();

  const { user, role } = useAuth();

  useEffect(() => {
    if (user && role) log(`Signed in as ${user.email} (${role})`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, role]);

  const [appMode, setAppMode] = useState<"idle" | "edit" | "create">("idle");
  const [activeCatalogSource, setActiveCatalogSource] = useState<{ family: string; variant: string; client: string; version: string } | undefined>(undefined);
  const [linkLoading, setLinkLoading] = useState(!!loadUrl);

  useEffect(() => {
    if (!loadUrl) return;
    const filename = catalogSource ? `v${catalogSource.version}.param` : "catalog.param";
    fetch(loadUrl)
      .then((r) => r.text())
      .then((content) => {
        loadFile(filename, content);
        setAppMode("edit");
        setActiveCatalogSource(catalogSource);
        setDroneLoaded(false);
      })
      .catch(() => log("Failed to load param file from URL", "ERROR"))
      .finally(() => setLinkLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUrl]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [droneLoaded, setDroneLoaded] = useState(false);
  const { droneParams } = useDroneParams();
  const droneParamsCount = droneParams?.length ?? 0;
  const [activePanel, setActivePanel] = useState<"protected" | "applied">("applied");
const [saveResumeOpen, setSaveResumeOpen] = useState(false);
  const [catalogUpload, setCatalogUpload] = useState<{ content: string; suggestedName: string } | null>(null);
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
    setActiveCatalogSource(undefined);
    setDroneLoaded(false);
  }, [paramDefs, createFromDefs, log]);

  const handleOpenDrone = useCallback(() => {
    if (!droneParams || droneParams.length === 0) return;
    const content = droneParams.map((p) => `${p.name},${p.value}`).join("\n");
    loadFile("drone.param", content);
    setAppMode("edit");
    setRemainingOverrides(new Map());
    setActiveCatalogSource(undefined);
    setDroneLoaded(true);
    log(`Loaded ${droneParams.length} drone params from memory`);
  }, [droneParams, loadFile, log]);

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
  const startHereId = useId();
  const saveListTitleId = useId();
  const saveListNameId = useId();
  const saveListDescId = useId();

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

  const handlePublishToCatalog = useCallback((header: string | null) => {
    const merged = remainingParams.map((p) => ({
      ...p,
      value: remainingOverrides.get(p.name) || p.value,
    }));
    const content = (header ?? "") + writeParamFile(merged);
    const baseName = fileName ? fileName.replace(/\.\w+$/, "") : "params";
    const suggestedName = appMode === "create" ? "new_config" : `${baseName}_filtered`;
    setSaveResumeOpen(false);
    setCatalogUpload({ content, suggestedName });
  }, [appMode, remainingParams, remainingOverrides, fileName]);

  const fileSource: "local" | "catalog" | "new" | "drone" | null =
    appMode === "create" ? "new" :
    appMode === "edit" && droneLoaded ? "drone" :
    appMode === "edit" && activeCatalogSource ? "catalog" :
    appMode === "edit" ? "local" :
    null;

  const nothingLoaded = protectedParams.length === 0 && remainingParams.length === 0;
  const dimUnless = (source: typeof fileSource) => fileSource && fileSource !== source && "opacity-40 hover:opacity-90";

  return (
    <div className="flex min-h-full flex-col px-4 pb-4 pt-4 sm:px-6 md:h-full md:min-h-176 md:overflow-hidden">
      <div className="mb-3 shrink-0">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Link href="/" className="transition-colors hover:text-foreground cursor-pointer whitespace-nowrap">Drones</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">Filter tool</span>
        </nav>
        <h1 className={`${pageTitleClass} mt-2`}>Filter tool</h1>
        <p className={pageLeadClass}>
          Load a .param file, choose which parameters are protected (left out), and export the rest.
        </p>
      </div>

      {/* Toolbar */}
      <header className={cn(
        cardClass,
        "mb-3 flex shrink-0 flex-wrap items-center gap-2 px-3 py-2 transition-colors duration-300",
        appMode === "create" && "border-emerald-600/40 bg-emerald-50 dark:border-emerald-700/50 dark:bg-emerald-950/40"
      )}>
        {/* Source group: Open .param | Catalog | New Config */}

        {/* 1. Open .param */}
        <FileUpload
          onFileLoaded={() => { setAppMode("edit"); setRemainingOverrides(new Map()); setActiveCatalogSource(undefined); setDroneLoaded(false); }}
          className={cn(dimUnless("local"))}
        />
        {fileSource === "local" && fileName && (
          <div className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted-foreground" title={fileName}>
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-36 truncate font-mono font-medium text-foreground">{fileName}</span>
          </div>
        )}

        {fileSource === "catalog" && activeCatalogSource && (
          <>
            <div className="hidden h-5 w-px shrink-0 bg-border sm:block" />
            <div className="flex h-9 min-w-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 text-[13px] font-medium text-primary whitespace-nowrap">
              <Library className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-72 truncate">
                {activeCatalogSource.family}
                <span className="opacity-60"> / </span>
                {activeCatalogSource.variant}
                <span className="opacity-60"> / </span>
                {activeCatalogSource.client}
                <span className="opacity-60"> / </span>
                <span className="font-mono">{activeCatalogSource.version}</span>
              </span>
            </div>
          </>
        )}

        <div className="hidden h-5 w-px shrink-0 bg-border sm:block" />

        {/* 3. New Config */}
        <button
          type="button"
          onClick={handleCreateNew}
          disabled={defsLoading}
          title="Browse all ArduPilot params — values will be 0 (pdef.json has no defaults)"
          className={cn(
            buttonClass("secondary", "md"),
            appMode === "create" && "border-emerald-600/50 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300",
            dimUnless("new")
          )}
        >
          <FilePlus className="h-4 w-4" />
          New Config
        </button>
        {fileSource === "new" && (
          <Badge tone="ok" title="Values are 0 — ArduPilot pdef.json does not publish firmware defaults">
            <FilePlus className="h-3 w-3" aria-hidden="true" />
            values are 0
          </Badge>
        )}

        <div className="hidden h-5 w-px shrink-0 bg-border sm:block" />
        <button
          type="button"
          onClick={handleOpenDrone}
          disabled={droneParamsCount === 0}
          title={
            droneParamsCount === 0
              ? "Import from drone first using the header button"
              : `Load ${droneParamsCount} drone params into the filter`
          }
          className={cn(
            buttonClass("secondary", "md"),
            fileSource === "drone"
              ? "border-emerald-600/50 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
              : droneParamsCount > 0 && "border-emerald-600/50 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300",
            dimUnless("drone")
          )}
        >
          <Usb className="h-4 w-4" />
          {fileSource === "drone"
            ? `Drone (${droneParamsCount} params)`
            : "Load drone"}
        </button>

        <div className="ml-auto flex w-full min-w-0 items-center justify-end gap-2 sm:w-auto">
          <ProtectionListSelect onEditLists={() => setEditorOpen(true)} />
          <div className="hidden h-5 w-px shrink-0 bg-border sm:block" />
          <button
            type="button"
            onClick={handleSave}
            disabled={remainingParams.length === 0}
            title={remainingParams.length === 0 ? "Nothing to export" : `Export ${remainingParams.length} params`}
            className={buttonClass("primary", "md")}
          >
            <Download className="h-4 w-4" />
            Export {remainingParams.length > 0 && (
              <span className="tabular-nums">({remainingParams.length})</span>
            )}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">

        {/* ── Transfer zone: Protected ⟵⟶ Applied ── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">

        {nothingLoaded && !linkLoading && (
          <section aria-labelledby={startHereId} className={`${cardClass} shrink-0 px-4 py-3.5`}>
            <h2 id={startHereId} className="text-sm font-semibold text-foreground">Start here</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Nothing is loaded yet. There are two ways to bring parameters in:</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
                  <FolderOpen className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-foreground">Open a .param file</span>
                  <span className="block text-[13px] leading-snug text-muted-foreground">Press “Open .param” above and pick a file from this computer.</span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
                  <Filter className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-foreground">Open a version from a drone</span>
                  <span className="block text-[13px] leading-snug text-muted-foreground">On a drone’s page, press “Open in Filter” on any version in its history.</span>
                </span>
              </li>
            </ul>
          </section>
        )}

        <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">

        {/* Protected panel */}
        <div ref={protectedPanelRef} className="flex max-h-[75vh] min-w-0 flex-1 flex-col md:max-h-none" onMouseEnter={() => setActivePanel("protected")}>
          <ParamPanel
            title="PROTECTED"
            tone="protected"
            variant="protected"
            isActive={activePanel === "protected"}
            loading={linkLoading}
            params={protectedParams}
            checkedNames={checkedProtected}
            pdefGroups={pdefGroups}
            onToggleCheck={toggleCheckedProtected}
            onToggleAll={toggleAllProtected}
            onToggleGroup={toggleGroupProtected}
            onSelectParam={selectParam}
            headerAction={
              <div className="flex items-center gap-2">
                {checkedProtected.size > 0 ? (
                  <button
                    type="button"
                    onClick={handleMoveToApplied}
                    title="Move checked params back to applied"
                    className={buttonClass("secondary", "sm")}
                  >
                    Apply {checkedProtected.size}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <>
                    <span
                      className="max-w-44 truncate font-mono text-xs text-protected-text"
                      title={activeListName === "__no_filter__" ? "No Filter" : activeListName}
                    >
                      {activeListName === "__no_filter__" ? "No Filter" : activeListName}
                    </span>
                    {isProtectionModified && (
                      <button
                        type="button"
                        onClick={openSaveList}
                        className={buttonClass("secondary", "sm")}
                        title="Save the current protected params as a new protection list"
                      >
                        <BookmarkPlus className="h-3.5 w-3.5" />
                        Save as list
                      </button>
                    )}
                  </>
                )}
              </div>
            }
          />
        </div>

        {/* Applied panel */}
        <div ref={appliedPanelRef} className="flex max-h-[75vh] min-w-0 flex-1 flex-col md:max-h-none" onMouseEnter={() => setActivePanel("applied")}>
          <ParamPanel
            title={appMode === "create" ? "DEFAULT VALUES" : "WILL BE APPLIED"}
            tone={appMode === "create" ? "defaults" : "applied"}
            variant="applied"
            isActive={activePanel === "applied"}
            loading={linkLoading}
            params={remainingParams}
            checkedNames={checkedRemaining}
            pdefGroups={pdefGroups}
            onToggleCheck={toggleCheckedRemaining}
            onToggleAll={toggleAllRemaining}
            onToggleGroup={toggleGroupRemaining}
            onSelectParam={selectParam}
            valueOverrides={remainingOverrides}
            onOverrideValue={handleRemainingOverride}
            headerAction={
              checkedRemaining.size > 0 ? (
                <button
                  type="button"
                  onClick={handleMoveToProtected}
                  title="Protect checked params (remove from output)"
                  className={buttonClass("secondary", "sm")}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Protect {checkedRemaining.size}
                </button>
              ) : null
            }
          />
        </div>

        </div>
        </div>{/* end transfer zone */}

        {/* ── Info sidebar (read-only, resizable) ── */}
        <div
          className="hidden shrink-0 lg:flex"
          style={{ width: infoWidth }}
        >
          {/* Drag handle: the gap between the panels and the sidebar */}
          <div
            onMouseDown={handleInfoDragStart}
            className="group flex w-3 shrink-0 cursor-col-resize items-center justify-center"
          >
            <span className="h-10 w-1 rounded-full bg-border transition-colors group-hover:bg-primary/60" />
          </div>
          <aside className={`${cardClass} flex min-w-0 flex-1 flex-col overflow-hidden`}>
            <div className="flex min-h-12 shrink-0 items-center border-b border-border px-4 py-2">
              <h2 className="text-sm font-semibold text-foreground">
                Parameter Info
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <DetailPanel />
            </div>
          </aside>
        </div>

      </div>

      {/* Bottom: Console + Status bar */}
      <div className="flex shrink-0 flex-col">
        {/* Drag handle: the gap above the console */}
        <div
          onMouseDown={handleConsoleDragStart}
          className="group flex h-3 shrink-0 cursor-row-resize items-center justify-center"
        >
          <span className="h-1 w-10 rounded-full bg-border transition-colors group-hover:bg-primary/60" />
        </div>
        <div className={`${cardClass} overflow-hidden`}>
          <div style={{ height: consoleHeight }}>
            <ConsolePanel />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
            <span>
              {statusMessage}
            </span>
            <span className="shrink-0">
              Cache: {defsLoading ? "loading..." : cacheAge}
            </span>
          </div>
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
          onPublishToCatalog={role === "contributor" || role === "admin" ? handlePublishToCatalog : undefined}
          onClose={() => setSaveResumeOpen(false)}
        />
      )}

      {catalogUpload && (
        <CatalogUploadModal
          content={catalogUpload.content}
          suggestedName={catalogUpload.suggestedName}
          onClose={() => setCatalogUpload(null)}
        />
      )}

      {/* Save selection as list dialog */}
      {saveListOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={saveListTitleId}
            className="relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-3.5">
              <h2 id={saveListTitleId} className="text-base font-semibold text-foreground">
                Save Selection as Protection List
              </h2>
              <button
                type="button"
                aria-label="Close"
                title="Close"
                onClick={() => setSaveListOpen(false)}
                className={buttonClass("ghost", "icon", "-mr-1.5")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
              {/* Name */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor={saveListNameId} className={labelClass}>
                  Name
                </label>
                <input
                  id={saveListNameId}
                  ref={saveListInputRef}
                  type="text"
                  value={saveListName}
                  onChange={(e) => setSaveListName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveList()}
                  placeholder="e.g. Battery Parameters"
                  className={fieldClass}
                />
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor={saveListDescId} className={labelClass}>
                  Description{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <input
                  id={saveListDescId}
                  type="text"
                  value={saveListDesc}
                  onChange={(e) => setSaveListDesc(e.target.value)}
                  placeholder="A short description"
                  className={fieldClass}
                />
              </div>

              {/* Preview of rules */}
              <div className="flex flex-col gap-1.5">
                <p className={labelClass}>
                  {protectedParams.length} exact rule
                  {protectedParams.length !== 1 ? "s" : ""} will be created
                </p>
                <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-secondary/50 px-3 py-2">
                  {protectedParams.slice(0, 8).map((p) => (
                    <p key={p.name} className="py-0.5 font-mono text-xs text-foreground">
                      <span className="mr-1.5 text-muted-foreground">ex:</span>
                      {p.name}
                    </p>
                  ))}
                  {protectedParams.length > 8 && (
                    <p className="pt-1 text-xs italic text-muted-foreground">
                      …and {protectedParams.length - 8} more
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-secondary/40 px-5 py-3">
              <button
                type="button"
                onClick={() => setSaveListOpen(false)}
                className={buttonClass("secondary")}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveList}
                disabled={!saveListName.trim()}
                className={buttonClass("primary")}
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
