"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Box, Check, ChevronDown, FileUp, GitCompareArrows, Search, Usb, X } from "lucide-react";
import { BusyButton, LoadingPanel } from "@/components/ui/busy";
import { buttonClass, cardClass, fieldClass, pageLeadClass, pageTitleClass } from "@/components/ui/styles";
import { useDroneParams, DRONE_VERSION_ID } from "@/lib/drone-params-context";
import { useSerialMode } from "@/lib/use-serial-mode";
import { parseParamFile } from "@/lib/param-engine";
import { FILE_VERSION_ID, readCompareFile, writeCompareFile, clearCompareFile, type CompareFilePayload } from "@/lib/file-compare-shared";
import type { PickerHistory } from "@/lib/version-picker";

/** What has been chosen to compare: stored versions, plus optionally a file and the connected drone. */
export interface CompareSelection {
  /** Stored version ids, in the order they were picked (the column order of the comparison). */
  ids: string[];
  file: CompareFilePayload | null;
  drone: boolean;
  count: number;
  has: (id: string) => boolean;
  toggle: (id: string) => void;
  setFile: (file: CompareFilePayload | null) => void;
  toggleDrone: () => void;
  clear: () => void;
  /** The comparison's URL. */
  href: string;
}

export function useCompareSelection(initial: string[] = []): CompareSelection {
  const [ids, setIds] = useState<string[]>(() => initial.filter((id) => id !== FILE_VERSION_ID && id !== DRONE_VERSION_ID));
  const [file, setFileState] = useState<CompareFilePayload | null>(null);
  const [drone, setDrone] = useState(() => initial.includes(DRONE_VERSION_ID));
  const wantsFile = initial.includes(FILE_VERSION_ID);

  // The file lives in this tab's sessionStorage, which only exists in the browser.
  useEffect(() => { if (wantsFile) setFileState(readCompareFile()); }, [wantsFile]);

  const toggle = useCallback((id: string) => {
    setIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);
  const setFile = useCallback((next: CompareFilePayload | null) => {
    if (next) writeCompareFile(next); else clearCompareFile();
    setFileState(next);
  }, []);
  const toggleDrone = useCallback(() => setDrone((d) => !d), []);
  const clear = useCallback(() => { setIds([]); setDrone(false); clearCompareFile(); setFileState(null); }, []);

  const href = useMemo(() => {
    const params = new URLSearchParams();
    if (drone) params.append("v", DRONE_VERSION_ID);
    if (file) params.append("v", FILE_VERSION_ID);
    for (const id of ids) params.append("v", id);
    return `/compare?${params.toString()}`;
  }, [ids, file, drone]);

  return {
    ids, file, drone,
    count: ids.length + (file ? 1 : 0) + (drone ? 1 : 0),
    has: (id) => ids.includes(id),
    toggle, setFile, toggleDrone, clear, href,
  };
}

/** "AIR4-0626-0024 v3" or "AIR8 · Base template v1" for every pickable version. */
export function versionLabels(histories: PickerHistory[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const h of histories) {
    const subject = h.kind === "template" ? `${h.modelName} template` : h.serial ?? h.clientName ?? h.modelName;
    for (const v of h.versions) out.set(v.id, `${subject} v${v.label}`);
  }
  return out;
}

/**
 * What is selected and the button that opens the comparison. Stays in view
 * while the page scrolls, so the action is never out of reach.
 */
export function SelectionTray({ selection, labelFor, onCancel }: {
  selection: CompareSelection;
  labelFor: (id: string) => string;
  /** Shown as "Cancel" when the tray belongs to a temporary selection mode. */
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [opening, startTransition] = useTransition();
  const { count } = selection;
  const chips: { key: string; label: string; remove: () => void }[] = [
    ...(selection.drone ? [{ key: DRONE_VERSION_ID, label: "Connected drone", remove: selection.toggleDrone }] : []),
    ...(selection.file ? [{ key: FILE_VERSION_ID, label: selection.file.name, remove: () => selection.setFile(null) }] : []),
    ...selection.ids.map((id) => ({ key: id, label: labelFor(id), remove: () => selection.toggle(id) })),
  ];

  return (
    <div className="sticky top-0 z-20 -mx-4 bg-background/90 px-4 py-2 backdrop-blur-sm sm:-mx-6 sm:px-6">
      <div className={`${cardClass} flex flex-col gap-2.5 border-primary/40 px-4 py-3 ring-1 ring-primary/15`} role="region" aria-label="Versions to compare">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <GitCompareArrows className="h-4 w-4" />
          </span>
          <div className="min-w-40 flex-1">
            <p className="text-sm font-semibold text-foreground" aria-live="polite">
              {count === 0 ? "Select the versions to compare" : `${count} selected`}
            </p>
            <p className="text-xs text-muted-foreground">Tick as many as you need. They can come from different drones.</p>
          </div>
          {onCancel && <button type="button" onClick={onCancel} className={buttonClass("secondary")}>Cancel</button>}
          <BusyButton
            type="button"
            variant="primary"
            busy={opening}
            busyLabel="Opening…"
            disabled={count === 0}
            icon={<GitCompareArrows className="h-3.5 w-3.5" />}
            onClick={() => startTransition(() => router.push(selection.href))}
          >
            {count >= 2 ? `Compare ${count} versions` : count === 1 ? "View this version" : "Compare"}
          </BusyButton>
        </div>
        {chips.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <li key={c.key} className="flex h-7 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 pl-2 pr-0.5 text-xs font-medium text-foreground">
                <span className="max-w-56 truncate">{c.label}</span>
                <button
                  type="button"
                  aria-label={`Remove ${c.label}`}
                  onClick={c.remove}
                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-primary/15 hover:text-foreground cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Choose versions from any drone or model template and, when `sources` is
 * given, a .param file or the connected drone. Used on the Compare page, under
 * a history's own versions, and by the Filter tool to open one version.
 */
export function VersionPicker({ histories, selection, sources, pickOne = false, excludeHistoryId }: {
  /** null while loading. */
  histories: PickerHistory[] | null;
  selection: Pick<CompareSelection, "has" | "toggle">;
  sources?: Pick<CompareSelection, "drone" | "file" | "toggleDrone" | "setFile">;
  /** Each press opens one version instead of ticking it. */
  pickOne?: boolean;
  /** A history whose versions are already listed elsewhere on the page. */
  excludeHistoryId?: string;
}) {
  const { droneParams, openImportDialog } = useDroneParams();
  const serialMode = useSerialMode();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ids = { search: useId(), file: useId() };
  const hasDrone = !!droneParams && droneParams.length > 0;

  async function pickFile(f: File | null) {
    if (!f) return;
    setFileError(null);
    const params = parseParamFile(await f.text()).map((p) => ({ name: p.name, value: p.value }));
    if (params.length === 0) { setFileError("No params found in that file."); return; }
    sources?.setFile({ name: f.name, params });
  }

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (histories ?? []).filter((h) => h.id !== excludeHistoryId).filter((h) =>
      !q || [h.modelName, h.serial, h.clientName, h.kind === "template" ? "template" : null].some((s) => s?.toLowerCase().includes(q))
    );
    const map = new Map<string, PickerHistory[]>();
    for (const h of list) map.set(h.modelName, [...(map.get(h.modelName) ?? []), h]);
    return [...map.entries()].map(([model, rows]) => ({ model, rows }));
  }, [histories, query, excludeHistoryId]);

  function toggleGroup(model: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(model)) next.delete(model); else next.add(model);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {sources && <div className={`${cardClass} divide-y divide-border`}>
        {(hasDrone || serialMode !== "unsupported") && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Usb className="h-4 w-4" /></span>
            <div className="min-w-40 flex-1">
              <p className="text-sm font-medium text-foreground">The connected drone</p>
              <p className="text-xs text-muted-foreground">
                {hasDrone ? `${droneParams.length} params, as they are on the drone right now.` : "Connect a drone to compare what is on it right now."}
              </p>
            </div>
            {hasDrone ? (
              <button type="button" aria-pressed={sources.drone} onClick={sources.toggleDrone} className={buttonClass(sources.drone ? "primary" : "secondary")}>
                {sources.drone ? <><Check className="h-3.5 w-3.5" /> Added</> : "Add"}
              </button>
            ) : (
              <button type="button" onClick={openImportDialog} className={buttonClass("secondary")}>
                <Usb className="h-3.5 w-3.5" /> Connect drone
              </button>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><FileUp className="h-4 w-4" /></span>
          <div className="min-w-40 flex-1">
            <p className="text-sm font-medium text-foreground">A .param file</p>
            <p className="text-xs text-muted-foreground">
              {sources.file
                ? <><span className="font-medium text-foreground">{sources.file.name}</span> · {sources.file.params.length} params · not saved</>
                : "For example one you received by email. It is compared without being uploaded or kept."}
            </p>
            {fileError && <p role="alert" className="text-xs text-destructive">{fileError}</p>}
          </div>
          {sources.file ? (
            <button type="button" onClick={() => sources.setFile(null)} className={buttonClass("secondary")}>Remove</button>
          ) : (
            <button type="button" onClick={() => fileInput.current?.click()} className={buttonClass("secondary")}>Choose file…</button>
          )}
          <label htmlFor={ids.file} className="sr-only">.param file to compare</label>
          <input
            id={ids.file}
            ref={fileInput}
            type="file"
            accept=".param,.parm,.txt"
            className="hidden"
            onChange={(e) => { pickFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
          />
        </div>
      </div>}

      {histories === null ? (
        <LoadingPanel label="Loading versions…" />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="relative min-w-56 flex-1">
              <label htmlFor={ids.search} className="sr-only">Find a drone, client or model</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id={ids.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a drone, client or model…"
                className={`${fieldClass} w-full pl-9 pr-7`}
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onMouseDown={(e) => { e.preventDefault(); setQuery(""); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" /> current target or template</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-dashed border-muted-foreground" aria-hidden="true" /> proposal</span>
            </p>
          </div>

          {groups.length === 0 ? (
            <div className={`${cardClass} px-6 py-10 text-center text-sm text-muted-foreground`}>
              {query ? "Nothing matches that search." : "No other versions yet."}
            </div>
          ) : (
            groups.map((g) => {
              const open = !collapsed.has(g.model) || query.trim() !== "";
              const drones = g.rows.filter((h) => h.kind === "drone").length;
              const picked = g.rows.reduce((n, h) => n + h.versions.filter((v) => selection.has(v.id)).length, 0);
              return (
                <section key={g.model} className={`${cardClass} overflow-hidden`}>
                  <h3>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => toggleGroup(g.model)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60 cursor-pointer"
                    >
                      <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground"><Box className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{g.model}</span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          {[g.rows.some((h) => h.kind === "template") ? "template" : null, drones > 0 ? `${drones} drone${drones === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {picked > 0 && !pickOne && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">{picked} selected</span>}
                    </button>
                  </h3>
                  {open && (
                    <ul className="relative border-t border-border before:absolute before:bottom-3 before:left-6 before:top-0 before:w-px before:bg-border">
                      {g.rows.map((h) => {
                        const subject = h.kind === "template" ? `${h.modelName} template` : h.serial ?? "Drone";
                        return (
                          <li
                            key={h.id}
                            className="relative ml-14 flex flex-col gap-2 border-b border-border py-2.5 pr-4 last:border-b-0 before:absolute before:-left-8 before:top-5 before:h-px before:w-5 before:bg-border sm:flex-row sm:items-center sm:gap-4"
                          >
                            <div className="min-w-0 sm:w-56 sm:shrink-0">
                              {h.kind === "template" ? (
                                <>
                                  <p className="text-sm font-medium text-foreground">Model template</p>
                                  <p className="text-xs text-muted-foreground">What new drones start from</p>
                                </>
                              ) : (
                                <>
                                  <p className="truncate font-mono text-sm font-semibold text-foreground">{h.serial}</p>
                                  <p className="truncate text-xs text-muted-foreground">{h.clientName ?? "No client"}</p>
                                </>
                              )}
                            </div>
                            <div className="flex flex-1 flex-wrap gap-1.5" role="group" aria-label={`Versions of ${subject}`}>
                              {h.versions.map((v) => {
                                const on = selection.has(v.id);
                                const note = v.isTarget ? (h.kind === "template" ? "current" : "target") : v.needsReview ? "proposal" : null;
                                return (
                                  <button
                                    key={v.id}
                                    type="button"
                                    aria-pressed={on}
                                    aria-label={`${subject} v${v.label}${note ? `, ${note}` : ""}`}
                                    title={`${when(v.createdAt)}${v.changelog ? ` — ${v.changelog}` : ""}`}
                                    onClick={() => selection.toggle(v.id)}
                                    className={`flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                                      on
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : v.needsReview
                                          ? "border-dashed border-input bg-card text-muted-foreground hover:border-primary hover:text-foreground"
                                          : "border-border bg-card text-foreground hover:border-primary hover:bg-primary/5"
                                    }`}
                                  >
                                    {on
                                      ? <Check className="h-3 w-3" />
                                      : !pickOne && <span className={`h-3 w-3 rounded-sm border ${v.needsReview ? "border-dashed border-muted-foreground" : "border-muted-foreground/60"}`} aria-hidden="true" />}
                                    <span className="font-mono">v{v.label}</span>
                                    {note && (
                                      <span className={`flex items-center gap-1 ${on ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                                        {v.isTarget && <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-primary-foreground" : "bg-emerald-500"}`} aria-hidden="true" />}
                                        {note}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              );
            })
          )}
        </>
      )}
    </div>
  );
}

/** The Compare page before a comparison is open. */
export function ComparePicker({ histories, initial }: { histories: PickerHistory[]; initial: string[] }) {
  const selection = useCompareSelection(initial);
  const labels = useMemo(() => versionLabels(histories), [histories]);
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8 sm:px-6">
      <div>
        <h1 className={pageTitleClass}>Compare</h1>
        <p className={pageLeadClass}>
          Put versions side by side to see every param that differs: versions of any drone, a model template, a .param file, or the connected drone.
        </p>
      </div>
      <SelectionTray selection={selection} labelFor={(id) => labels.get(id) ?? "A version"} />
      <VersionPicker histories={histories} selection={selection} sources={selection} />
    </div>
  );
}
