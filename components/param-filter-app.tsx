"use client";

import { useEffect, useCallback } from "react";
import { RefreshCw, FileText, ArrowLeft, ArrowRight, Download, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/app-context";
import { writeParamFile } from "@/lib/param-engine";
import { FileUpload } from "@/components/file-upload";
import { ProtectionListSelect } from "@/components/protection-list-select";
import { ParamPanel } from "@/components/param-panel";
import { DetailPanel } from "@/components/detail-panel";
import { ConsolePanel } from "@/components/console-panel";
import { ListEditorDialog } from "@/components/list-editor-dialog";
import { useState } from "react";

export function ParamFilterApp() {
  const {
    fileName,
    protectedParams,
    remainingParams,
    checkedProtected,
    checkedRemaining,
    pdefGroups,
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
    log,
  } = useApp();

  const [editorOpen, setEditorOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    log("Fetching latest parameter definitions from ArduPilot...");
    try {
      const res = await fetch("/api/param-definitions?force");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setParamDefs(data.params, data.groups, "just now");
      log(
        `Definitions updated \u2014 ${Object.keys(data.params).length} params, ${data.groups.length} groups`
      );
    } catch (err) {
      log(`Fetch failed: ${(err as Error).message}`, "ERROR");
    } finally {
      setRefreshing(false);
    }
  }, [log, setParamDefs]);

  const handleSave = useCallback(() => {
    if (remainingParams.length === 0) return;
    const content = writeParamFile(remainingParams);
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = fileName ? fileName.replace(/\.\w+$/, "") : "params";
    a.href = url;
    a.download = `${baseName}_filtered.param`;
    a.click();
    URL.revokeObjectURL(url);
    log(
      `Saved '${baseName}_filtered.param' \u2014 ${remainingParams.length} written, ${protectedParams.length} removed`
    );
  }, [remainingParams, protectedParams, fileName, log]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Toolbar */}
      <header className="flex items-center gap-4 border-b border-border bg-toolbar px-4 py-2.5 shrink-0 flex-wrap">
        <FileUpload />
        {fileName && (
          <div className="flex items-center gap-1.5 text-sm text-foreground">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{fileName}</span>
          </div>
        )}
        <div className="flex-1" />
        <ProtectionListSelect />
        <button
          onClick={() => setEditorOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
        >
          <Settings className="h-4 w-4" />
          Edit Lists
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-primary-foreground transition-colors",
            "bg-[#2d5a27] hover:bg-[#3a7232] disabled:opacity-50"
          )}
        >
          <RefreshCw
            className={cn("h-4 w-4", refreshing && "animate-spin")}
          />
          {refreshing ? "Fetching..." : "Refresh Params"}
        </button>
      </header>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Protected panel */}
        <div className="flex flex-col w-[32%] min-w-0 p-2">
          <ParamPanel
            title="PROTECTED — will be removed"
            headerColor="bg-protected-header"
            params={protectedParams}
            checkedNames={checkedProtected}
            pdefGroups={pdefGroups}
            onToggleCheck={toggleCheckedProtected}
            onToggleAll={toggleAllProtected}
            onToggleGroup={toggleGroupProtected}
            onSelectParam={selectParam}
          />
        </div>

        {/* Center: Move buttons */}
        <div className="flex flex-col items-center justify-center gap-3 px-1 py-4 shrink-0">
          <button
            onClick={moveCheckedToProtected}
            disabled={checkedRemaining.size === 0}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg px-3 py-3 text-xs font-bold transition-colors",
              "bg-protected-header text-foreground hover:bg-[#8b3a3a] disabled:opacity-30 disabled:cursor-not-allowed"
            )}
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="mt-0.5">Protect</span>
          </button>
          <button
            onClick={moveCheckedToRemaining}
            disabled={checkedProtected.size === 0}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg px-3 py-3 text-xs font-bold transition-colors",
              "bg-applied-header text-foreground hover:bg-[#3a7232] disabled:opacity-30 disabled:cursor-not-allowed"
            )}
          >
            <span className="mb-0.5">Apply</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        {/* Right side: Applied + Detail */}
        <div className="flex flex-col flex-1 min-w-0 p-2 gap-2">
          <div className="flex flex-1 gap-2 min-h-0">
            {/* Applied panel */}
            <div className="flex flex-col flex-1 min-w-0">
              <ParamPanel
                title="WILL BE APPLIED"
                headerColor="bg-applied-header"
                params={remainingParams}
                checkedNames={checkedRemaining}
                pdefGroups={pdefGroups}
                onToggleCheck={toggleCheckedRemaining}
                onToggleAll={toggleAllRemaining}
                onToggleGroup={toggleGroupRemaining}
                onSelectParam={selectParam}
              />
            </div>
            {/* Detail panel */}
            <div className="hidden lg:flex lg:flex-col w-[260px] shrink-0 rounded-lg border border-border bg-card overflow-hidden">
              <div className="border-b border-border px-3 py-2">
                <h3 className="text-xs font-semibold text-foreground">
                  Parameter Info
                </h3>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <DetailPanel />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Console + Status bar */}
      <div className="flex flex-col shrink-0 border-t border-border">
        <div className="h-[140px]">
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
              Save Filtered File
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

      {/* List Editor Dialog */}
      {editorOpen && (
        <ListEditorDialog onClose={() => setEditorOpen(false)} />
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
