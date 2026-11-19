"use client";

import { useEffect, useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import Link from "next/link";
import { FileText, FilePlus, FolderOpen, ArrowLeft, ArrowRight, Download, BookmarkPlus, Usb, Box, Plane, ExternalLink, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import { useAuth } from "@/components/auth-provider";
import { writeParamFile } from "@/lib/param-engine";
import { ProtectionListSelect } from "@/components/protection-list-select";
import { ParamPanel } from "@/components/param-panel";
import { DetailPanel } from "@/components/detail-panel";
import { ConsolePanel } from "@/components/console-panel";
import { ListEditorDialog } from "@/components/list-editor-dialog";
import { SaveResumeModal } from "@/components/save-resume-modal";
import { CatalogUploadModal } from "@/components/catalog-upload-modal";
import { VersionPicker } from "@/components/compare/version-picker";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/busy";
import { Badge } from "@/components/status-badge";
import { useDroneParams } from "@/lib/drone-params-context";
import { useConnectedDroneMatch } from "@/lib/use-connected-drone-match";
import { useSerialMode } from "@/lib/use-serial-mode";
import { droneHref, modelHref } from "@/lib/versions";
import type { PickerHistory, PickerVersion } from "@/lib/version-picker";
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

/** Where the params in the filter came from. */
type Source =
  | { kind: "file"; name: string }
  | { kind: "version"; id: string; subject: string; label: string; note: string | null; detail: string; href: string; serial: string | null }
  | { kind: "drone" }
  | { kind: "blank" };

function findVersion(histories: PickerHistory[], id: string): { h: PickerHistory; v: PickerVersion } | null {
  for (const h of histories) {
    const v = h.versions.find((x) => x.id === id);
    if (v) return { h, v };
  }
  return null;
}

function setFilterUrl(versionId: string | null): void {
  window.history.replaceState(null, "", versionId ? `/filter?versionId=${versionId}` : "/filter");
}

export function ParamFilterApp({ histories, initialVersionId }: { histories: PickerHistory[]; initialVersionId?: string }) {
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

  const [source, setSource] = useState<Source | null>(null);
  /** What is being fetched, for the busy line; null when nothing is. */
  const [opening, setOpening] = useState<string | null>(initialVersionId ? "the version" : null);
  const [fleetOpen, setFleetOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  const { droneParams, readAt, openImportDialog } = useDroneParams();
  const droneParamsCount = droneParams?.length ?? 0;
  const match = useConnectedDroneMatch();
  const connectedSerial = match.status === "linked" ? match.drone?.serial ?? null : null;
  const serialMode = useSerialMode();

  const [editorOpen, setEditorOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<"protected" | "applied">("applied");
  const [saveResumeOpen, setSaveResumeOpen] = useState(false);
  const [catalogUpload, setCatalogUpload] = useState<{ content: string; suggestedName: string } | null>(null);
  const [remainingOverrides, setRemainingOverrides] = useState<Map<string, string>>(new Map());
  const [flyingRows, setFlyingRows] = useState<FlyingRow[]>([]);

  const protectedPanelRef = useRef<HTMLDivElement>(null);
  const appliedPanelRef = useRef<HTMLDivElement>(null);

  const use = useCallback((next: Source, name: string, content: string) => {
    loadFile(name, content);
    setSource(next);
    setRemainingOverrides(new Map());
    setFilterUrl(next.kind === "version" ? next.id : null);
  }, [loadFile]);

  const openVersion = useCallback(async (id: string) => {
    const hit = findVersion(histories, id);
    if (!hit) {
      setOpening(null);
      log("That version is not available to you", "ERROR");
      return;
    }
    const { h, v } = hit;
    const subject = h.kind === "template" ? `${h.modelName} template` : h.serial ?? "Drone";
    setOpening(`${subject} v${v.label}`);
    try {
      const res = await fetch(`/api/versions/${id}/file`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const content = await res.text();
      use(
        {
          kind: "version",
          id,
          subject,
          label: v.label,
          note: v.isTarget ? (h.kind === "template" ? "current template" : "target") : v.needsReview ? "proposal" : null,
          detail: h.kind === "template" ? "Model template" : [h.clientName ?? "No client", h.modelName].join(" · "),
          href: h.kind === "template" ? modelHref(h.variantId) : droneHref(h.serial ?? ""),
          serial: h.kind === "drone" ? h.serial : null,
        },
        `${subject.replace(/[^A-Za-z0-9_-]+/g, "-")}-v${v.label}.param`,
        content,
      );
    } catch (err) {
      log(`Could not open ${subject} v${v.label}: ${(err as Error).message}`, "ERROR");
    } finally {
      setOpening(null);
    }
  }, [histories, use, log]);

  useEffect(() => {
    if (initialVersionId) void openVersion(initialVersionId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVersionId]);

  function pickFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => use({ kind: "file", name: file.name }, file.name, reader.result as string);
    reader.readAsText(file);
  }

  const useConnectedDrone = useCallback(() => {
    if (!droneParams || droneParams.length === 0) return;
    use({ kind: "drone" }, `${connectedSerial ?? "drone"}.param`, droneParams.map((p) => `${p.name},${p.value}`).join("\n"));
  }, [droneParams, connectedSerial, use]);

  // "Connect a drone" from here loads its params as soon as the read finishes.
  const wantsDrone = useRef(false);
  useEffect(() => {
    if (wantsDrone.current && droneParamsCount > 0) {
      wantsDrone.current = false;
      useConnectedDrone();
    }
  }, [droneParamsCount, useConnectedDrone]);

  const connectDrone = useCallback(() => {
    wantsDrone.current = true;
    openImportDialog();
  }, [openImportDialog]);

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
    setSource({ kind: "blank" });
    setRemainingOverrides(new Map());
    setFilterUrl(null);
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
  const startHereId = useId();
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
    const outName = source?.kind === "blank"
      ? "new_config.param"
      : `${baseName}_filtered.param`;
    a.href = url;
    a.download = outName;
    a.click();
    URL.revokeObjectURL(url);
    log(
      `Saved '${outName}' \u2014 ${merged.length} written${source?.kind !== "blank" ? `, ${protectedParams.length} removed` : ""}`
    );
  }, [source, protectedParams, remainingParams, remainingOverrides, fileName, log]);

  const handlePublishToCatalog = useCallback((header: string | null) => {
    const merged = remainingParams.map((p) => ({
      ...p,
      value: remainingOverrides.get(p.name) || p.value,
    }));
    const content = (header ?? "") + writeParamFile(merged);
    const baseName = fileName ? fileName.replace(/\.\w+$/, "") : "params";
    const suggestedName = source?.kind === "blank" ? "new_config" : `${baseName}_filtered`;
    setSaveResumeOpen(false);
    setCatalogUpload({ content, suggestedName });
  }, [source, remainingParams, remainingOverrides, fileName]);

  const isBlank = source?.kind === "blank";
  const nothingLoaded = protectedParams.length === 0 && remainingParams.length === 0;
  const showPanels = !nothingLoaded || opening !== null;
  const hasDrone = droneParamsCount > 0;
  const canConnect = serialMode !== "unsupported";
  const saveSerial = source?.kind === "version" ? source.serial : source?.kind === "drone" ? connectedSerial : null;

  const choices: { key: string; icon: LucideIcon; label: React.ReactNode; title: string; text: string; onClick: () => void; disabled?: boolean; live?: boolean }[] = [
    {
      key: "fleet",
      icon: Plane,
      label: "Choose a drone…",
      title: "A saved version of any drone or model template",
      text: "Pick a drone from the fleet, then the version to start from.",
      onClick: () => setFleetOpen(true),
    },
    ...(hasDrone
      ? [{
          key: "drone",
          icon: Usb,
          label: connectedSerial ? <>Use <span className="font-mono">{connectedSerial}</span></> : "Use connected drone",
          title: `Load the ${droneParamsCount} params read from the connected drone`,
          text: `${droneParamsCount} params, as they are on ${connectedSerial ?? "the connected drone"} right now.`,
          onClick: useConnectedDrone,
          live: true,
        }]
      : canConnect
        ? [{
            key: "drone",
            icon: Usb,
            label: "Connect a drone",
            title: "Plug a drone in over USB and read its params",
            text: "Plug one in over USB; its params load here once they are read.",
            onClick: connectDrone,
          }]
        : []),
    {
      key: "file",
      icon: FolderOpen,
      label: "Load .param file",
      title: "Open a .param file from this computer",
      text: "A file from this computer, for example one you received by email.",
      onClick: () => fileInput.current?.click(),
    },
    {
      key: "blank",
      icon: FilePlus,
      label: "Blank config",
      title: "Every ArduPilot param, with value 0 (ArduPilot publishes no defaults)",
      text: "Every ArduPilot param with value 0, to build a file from scratch.",
      onClick: handleCreateNew,
      disabled: defsLoading,
    },
  ];

  return (
    <div className="flex min-h-full flex-col px-4 pb-4 pt-4 sm:px-6 md:h-full md:min-h-176 md:overflow-hidden">
      <div className="mb-3 shrink-0">
        <h1 className={pageTitleClass}>Filter</h1>
        <p className={pageLeadClass}>
          Start from a drone, a file or a blank config, leave out the protected params, and export the rest or save it to a drone.
        </p>
      </div>

      <label htmlFor={fileInputId} className="sr-only">.param file to load</label>
      <input
        id={fileInputId}
        ref={fileInput}
        type="file"
        accept=".param,.parm,.txt"
        className="hidden"
        onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ""; }}
      />

      {/* What is loaded, the protection list and the export */}
      <section aria-label="Source" className={cn(cardClass, "mb-3 shrink-0 overflow-hidden")}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
          <SourceSummary source={source} opening={opening} fileName={fileName} count={protectedParams.length + remainingParams.length} connectedSerial={connectedSerial} readAt={readAt} />
          <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2 sm:w-auto">
            <ProtectionListSelect onEditLists={() => setEditorOpen(true)} />
            <button
              type="button"
              onClick={handleSave}
              disabled={remainingParams.length === 0}
              title={remainingParams.length === 0 ? "Nothing to export" : `Export ${remainingParams.length} params`}
              className={buttonClass("primary", "md")}
            >
              <Download className="h-4 w-4" />
              Export {remainingParams.length > 0 && <span className="tabular-nums">({remainingParams.length})</span>}
            </button>
          </div>
        </div>
        {!nothingLoaded && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-secondary/40 px-4 py-2">
            <span className="mr-1 text-xs font-medium text-muted-foreground">Start over from</span>
            {choices.map((c) => (
              <button key={c.key} type="button" onClick={c.onClick} disabled={c.disabled} title={c.title} className={buttonClass("secondary", "sm")}>
                <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
                {c.label}
                {c.live && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Main content */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">

        {/* ── Transfer zone: Protected ⟵⟶ Applied ── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">

        {!showPanels && (
          <section aria-labelledby={startHereId} className={cn(cardClass, "shrink-0 px-5 py-5")}>
            <h2 id={startHereId} className="text-base font-semibold text-foreground">Where do the params come from?</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Pick a starting point. You can start over from another one at any time.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {choices.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={c.onClick}
                  disabled={c.disabled}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-xs transition-colors hover:border-primary hover:bg-primary/5 cursor-pointer disabled:cursor-wait disabled:opacity-60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
                    <c.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {c.label}
                      {c.live && <Badge tone="ok">connected</Badge>}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{c.text}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {showPanels && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 md:flex-row">

        {/* Protected panel */}
        <div ref={protectedPanelRef} className="flex max-h-[75vh] min-w-0 flex-1 flex-col md:max-h-none" onMouseEnter={() => setActivePanel("protected")}>
          <ParamPanel
            title="Protected"
            tone="protected"
            variant="protected"
            isActive={activePanel === "protected"}
            loading={opening !== null}
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
            title={isBlank ? "Default values" : "Will be applied"}
            tone={isBlank ? "defaults" : "applied"}
            variant="applied"
            isActive={activePanel === "applied"}
            loading={opening !== null}
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
        )}
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

      {fleetOpen && (
        <Dialog title="Choose a drone" size="xl" onClose={() => setFleetOpen(false)}>
          <p className="-mt-1 text-[13px] text-muted-foreground">
            Find the drone, then press the version to open. The green dot marks the version each drone should be on.
          </p>
          <VersionPicker
            histories={histories}
            pickOne
            selection={{
              has: (id) => source?.kind === "version" && source.id === id,
              toggle: (id) => { setFleetOpen(false); void openVersion(id); },
            }}
          />
        </Dialog>
      )}

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
          preferSerial={saveSerial}
          content={catalogUpload.content}
          suggestedName={catalogUpload.suggestedName}
          onClose={() => setCatalogUpload(null)}
        />
      )}

      {saveListOpen && (
        <Dialog
          title="Save selection as a protection list"
          onClose={() => setSaveListOpen(false)}
          onSubmit={(e) => { e.preventDefault(); handleSaveList(); }}
          footer={
            <>
              <button type="button" onClick={() => setSaveListOpen(false)} className={buttonClass("secondary")}>Cancel</button>
              <button type="submit" disabled={!saveListName.trim()} className={buttonClass("primary")}>Create list</button>
            </>
          }
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor={saveListNameId} className={labelClass}>Name</label>
            <input
              id={saveListNameId}
              ref={saveListInputRef}
              type="text"
              value={saveListName}
              onChange={(e) => setSaveListName(e.target.value)}
              placeholder="e.g. Battery Parameters"
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={saveListDescId} className={labelClass}>
              Description <span className="font-normal text-muted-foreground">(optional)</span>
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
          <div className="flex flex-col gap-1.5">
            <p className={labelClass}>
              {protectedParams.length} exact rule{protectedParams.length !== 1 ? "s" : ""} will be created
            </p>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-secondary/50 px-3 py-2">
              {protectedParams.slice(0, 8).map((p) => (
                <p key={p.name} className="py-0.5 font-mono text-xs text-foreground">
                  <span className="mr-1.5 text-muted-foreground">ex:</span>
                  {p.name}
                </p>
              ))}
              {protectedParams.length > 8 && (
                <p className="pt-1 text-xs italic text-muted-foreground">…and {protectedParams.length - 8} more</p>
              )}
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function SourceSummary({ source, opening, fileName, count, connectedSerial, readAt }: {
  source: Source | null;
  opening: string | null;
  fileName: string | null;
  count: number;
  connectedSerial: string | null;
  readAt: number | null;
}) {
  let icon: LucideIcon = FileText;
  let title: React.ReactNode = "Nothing loaded yet";
  let detail: React.ReactNode = "Choose where the params come from below.";
  let note: string | null = null;
  let href: string | null = null;

  if (opening) {
    title = <span className="flex items-center gap-2"><Spinner className="h-3.5 w-3.5" /> Opening {opening}…</span>;
    detail = "Fetching the file.";
  } else if (source?.kind === "version") {
    icon = source.serial ? Plane : Box;
    title = <><span className={source.serial ? "font-mono" : undefined}>{source.subject}</span> <span className="font-mono">v{source.label}</span></>;
    detail = <>{source.detail} · {count} params</>;
    note = source.note;
    href = source.href;
  } else if (source?.kind === "drone") {
    icon = Usb;
    title = connectedSerial ? <span className="font-mono">{connectedSerial}</span> : "The connected drone";
    detail = <>Read from the connected drone{readAt ? <> at {new Date(readAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</> : null} · {count} params</>;
    note = "live";
    href = connectedSerial ? droneHref(connectedSerial) : null;
  } else if (source?.kind === "file") {
    title = <span className="font-mono">{source.name}</span>;
    detail = <>File from this computer · {count} params</>;
  } else if (source?.kind === "blank") {
    icon = FilePlus;
    title = "Blank config";
    detail = "Every ArduPilot param, value 0 — ArduPilot publishes no defaults";
  } else if (fileName) {
    title = <span className="font-mono">{fileName}</span>;
  }
  const Icon = icon;

  return (
    <div className="flex min-w-56 flex-1 items-center gap-3">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", source ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")} aria-hidden="true">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
          {title}
          {note && <Badge tone={note === "proposal" ? "muted" : "ok"}>{note}</Badge>}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span>{detail}</span>
          {href && (
            <Link href={href} className="inline-flex items-center gap-1 font-medium text-primary hover:underline cursor-pointer whitespace-nowrap">
              {source?.kind === "version" && !source.serial ? "Model page" : "Drone page"} <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </p>
      </div>
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
