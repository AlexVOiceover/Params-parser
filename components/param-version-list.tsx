"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Filter, Download, Trash2, Copy, X, AlertTriangle, Upload, Eye, Usb, GitCompareArrows, CheckSquare, Square } from "lucide-react";
import { ApplyUpdateButton } from "@/components/apply-update-button";
import { useDroneParams } from "@/lib/drone-params-context";
import { useConnectedDroneMatch, clearDroneMatchCache } from "@/lib/use-connected-drone-match";
import { writeParamFile } from "@/lib/param-engine";

interface ParamVersionRow {
  id: string;
  version_label: string;
  storage_path: string;
  changelog: string | null;
  created_at: string;
  is_latest: boolean;
  needs_review: boolean;
}

interface FamilyOption {
  id: string;
  name: string;
}

interface VariantOption {
  id: string;
  name: string;
}

interface ClientSetOption {
  id: string;
  client_name: string;
  serial: string;
  is_default: boolean;
}

interface Props {
  versions: ParamVersionRow[];
  familySlug: string;
  familyId: string;
  variantId: string;
  clientSetId: string;
  isAdmin: boolean;
  isDefault: boolean;
  /** FK drone_id on this client_set — used to match against the connected drone. */
  droneId: string | null;
  /** Diff count vs the previous version (oldest-first ordering). Key = version id. */
  diffVsPrev?: Record<string, number>;
  familyName: string;
  variantName: string;
  clientSetName: string;
}

const NEW_CLIENT_SET = "__new__";
const NEW_DEFAULT = "__default__";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function storageUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/param-files/${path}`;
}

async function downloadParamFile(path: string, filename: string) {
  const res = await fetch(storageUrl(path));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function nextVersion(versions: ParamVersionRow[]): string {
  const nums = versions
    .map((v) => parseInt(v.version_label, 10))
    .filter((n) => Number.isFinite(n));
  if (nums.length === 0) return "1";
  return String(Math.max(...nums) + 1);
}

export function ParamVersionList({
  versions,
  familySlug,
  familyId,
  variantId,
  clientSetId,
  isAdmin,
  isDefault,
  droneId,
  diffVsPrev,
  familyName,
  variantName,
  clientSetName,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { droneParams } = useDroneParams();
  const match = useConnectedDroneMatch();
  // This page belongs to a specific client_set. The drone matches this set
  // when the connected drone's id equals the FK stored on the client_set.
  const droneMatchesThisSet = match.status === "matched" && droneId !== null && match.drone?.id === droneId;
  const hasUpdate = droneMatchesThisSet && match.versionStatus === "update_available";
  const droneVersion = droneMatchesThisSet ? match.droneVersion : null;

  // ── Compare mode ──────────────────────────────────────────
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelected, setCompareSelected] = useState<Set<string>>(new Set());

  function toggleCompareMode() {
    setCompareMode((v) => !v);
    setCompareSelected(new Set());
  }

  function toggleCompareSelect(id: string) {
    setCompareSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function goToCompare() {
    const ids = [...compareSelected];
    if (ids.length < 2) return;
    router.push(`/compare?${ids.map((id) => `v=${id}`).join("&")}`);
  }

  // ── Delete state ──────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Upload state ──────────────────────────────────────────
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadSource, setUploadSource] = useState<"file" | "drone">("file");
  const [uploadChangelog, setUploadChangelog] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLog, setUploadLog] = useState<{ text: string; error?: boolean }[]>([]);

  // ── Clone state ───────────────────────────────────────────
  const [cloneId, setCloneId] = useState<string | null>(null);
  const [cloneFamilyId, setCloneFamilyId] = useState(familyId);
  const [cloneVariantId, setCloneVariantId] = useState(variantId);
  const [cloneClientSetId, setCloneClientSetId] = useState(clientSetId);
  const [cloneVersionLabel, setCloneVersionLabel] = useState("");
  const [cloneChangelog, setCloneChangelog] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [newClientSetDescription, setNewClientSetDescription] = useState("");
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  // ── Dropdown data ─────────────────────────────────────────
  const [families, setFamilies] = useState<FamilyOption[]>([]);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [clientSets, setClientSets] = useState<ClientSetOption[]>([]);

  const deleteTarget = versions.find((v) => v.id === deleteId);
  const cloneTarget = versions.find((v) => v.id === cloneId);
  const isNewClientSet = cloneClientSetId === NEW_CLIENT_SET;
  const isNewDefault = cloneClientSetId === NEW_DEFAULT;

  // Load families on first admin render
  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/families").then((r) => r.json()).then(({ families: fs }) => {
      setFamilies(fs ?? []);
    });
  }, [isAdmin]);

  // Reload variants whenever the selected family changes
  useEffect(() => {
    if (!cloneId) return;
    setVariants([]);
    fetch(`/api/admin/variants?familyId=${cloneFamilyId}`)
      .then((r) => r.json())
      .then(({ variants: vs }) => {
        setVariants(vs ?? []);
        setCloneVariantId((prev) => {
          const stillExists = (vs ?? []).some((v: VariantOption) => v.id === prev);
          if (stillExists) return prev;
          return vs?.[0]?.id ?? "";
        });
      });
  }, [cloneFamilyId, cloneId]);

  // Reload client sets whenever the selected variant changes
  useEffect(() => {
    if (!cloneId || !cloneVariantId) return;
    setClientSets([]);
    fetch(`/api/admin/client-sets?variantId=${cloneVariantId}`)
      .then((r) => r.json())
      .then(({ clientSets: cs }) => {
        setClientSets(cs ?? []);
        setCloneClientSetId((prev) => {
          if (prev === NEW_CLIENT_SET) return NEW_CLIENT_SET;
          const stillExists = (cs ?? []).some((c: ClientSetOption) => c.id === prev);
          if (stillExists) return prev;
          return cs?.[0]?.id ?? NEW_CLIENT_SET;
        });
      });
  }, [cloneVariantId, cloneId]);

  const uploadVersionLabel = nextVersion(versions);

  function openUpload() {
    setUploadChangelog("");
    setUploadFile(null);
    setUploadSource("file");
    setUploadLog([]);
    setUploadOpen(true);
  }

  async function handleUpload() {
    let file = uploadFile;
    if (uploadSource === "drone") {
      if (!droneParams || droneParams.length === 0) return;
      const content = writeParamFile(droneParams.map((p) => ({ name: p.name, value: p.value })));
      file = new File([content], `${clientSetName.replace(/\s+/g, "_")}_from_drone.param`, { type: "text/plain" });
    }
    if (!file || !uploadVersionLabel) return;
    setUploading(true);
    setUploadLog([]);

    const fd = new FormData();
    fd.set("clientSetId", clientSetId);
    fd.set("versionLabel", uploadVersionLabel);
    if (uploadChangelog) fd.set("changelog", uploadChangelog);
    fd.set("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    if (!reader) {
      setUploadLog([{ text: "No response from server", error: true }]);
      setUploading(false);
      return;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.done) {
            setUploading(false);
            setTimeout(() => {
              setUploadOpen(false);
              clearDroneMatchCache();
              startTransition(() => router.refresh());
            }, 800);
            return;
          }
          setUploadLog((prev) => [...prev, { text: parsed.text, error: parsed.error }]);
        } catch {}
      }
    }

    setUploading(false);
  }

  function openClone(v: ParamVersionRow) {
    setCloneError(null);
    setCloneFamilyId(familyId);
    setCloneVariantId(variantId);
    setCloneClientSetId(clientSetId);
    setCloneVersionLabel(nextVersion(versions));
    setCloneChangelog(v.changelog ?? "");
    setNewClientName("");
    setNewSerial("");
    setNewClientSetDescription("");
    setCloneId(v.id);
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/admin/param-versions/${deleteId}`, { method: "DELETE" });
    if (res.ok) {
      setDeleteId(null);
      setDeleting(false);
      clearDroneMatchCache();
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setDeleteError(msg ?? "Delete failed");
      setDeleting(false);
    }
  }

  async function handleClone() {
    if (!cloneId) return;
    setCloning(true);
    setCloneError(null);
    const isNewDefault = cloneClientSetId === NEW_DEFAULT;
    const res = await fetch(`/api/admin/param-versions/${cloneId}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantId: cloneVariantId,
        clientSetId: (isNewClientSet || isNewDefault) ? null : cloneClientSetId,
        createDefault: isNewDefault ? true : undefined,
        newClientSet: isNewClientSet ? { clientName: newClientName, serial: newSerial, description: newClientSetDescription } : undefined,
        versionLabel: cloneVersionLabel,
        changelog: cloneChangelog,
      }),
    });
    if (res.ok) {
      setCloneId(null);
      setCloning(false);
      clearDroneMatchCache();
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setCloneError(msg ?? "Clone failed");
      setCloning(false);
    }
  }

  const versionLabelValid = /^\d+$/.test(cloneVersionLabel.trim());
  const cloneDisabled =
    cloning ||
    !cloneVersionLabel.trim() ||
    !versionLabelValid ||
    !cloneVariantId ||
    (isNewClientSet && (!newClientName.trim() || !newSerial.trim()));
  // isNewDefault needs no extra fields — variant is sufficient

  const uploadDisabled = uploading || (uploadSource === "file" ? !uploadFile : !droneParams?.length);
  const uploadHasError = uploadLog.some((l) => l.error);

  return (
    <>
      {versions.length > 1 && (
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={toggleCompareMode}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              compareMode
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-foreground hover:bg-secondary"
            }`}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            {compareMode ? "Cancel" : "Compare versions"}
          </button>
          {compareMode && (
            <>
              <span className="text-xs text-muted-foreground">
                {compareSelected.size === 0
                  ? "Select versions to compare"
                  : `${compareSelected.size} selected`}
              </span>
              {compareSelected.size >= 2 && (
                <button
                  type="button"
                  onClick={goToCompare}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <GitCompareArrows className="h-3.5 w-3.5" />
                  Compare {compareSelected.size}
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {versions.length === 0 && !isAdmin && (
          <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">No versions uploaded yet.</p>
          </div>
        )}

        {versions.map((v) => (
          <div key={v.id} className={`relative group/row flex items-stretch gap-2`}>
            {compareMode && (
              <button
                type="button"
                onClick={() => toggleCompareSelect(v.id)}
                className={`shrink-0 flex items-center justify-center w-10 rounded-lg border transition-colors cursor-pointer ${
                  compareSelected.has(v.id)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary"
                }`}
                aria-label={compareSelected.has(v.id) ? "Deselect" : "Select for compare"}
              >
                {compareSelected.has(v.id)
                  ? <CheckSquare className="h-4 w-4" />
                  : <Square className="h-4 w-4" />}
              </button>
            )}
            <div className={`flex-1 rounded-lg border border-border bg-card px-4 py-3${compareMode && compareSelected.has(v.id) ? " border-primary/50 bg-primary/5" : ""}`}>
              {/* Top row: version + badges left, date right */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-sm font-semibold text-foreground font-mono shrink-0">v{v.version_label}</span>
                  {v.is_latest && (
                    <span className="rounded-full bg-emerald-900/50 border border-emerald-700/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 shrink-0">latest</span>
                  )}
                  {v.needs_review && (
                    <span className="rounded-full bg-amber-900/50 border border-amber-700/60 px-2 py-0.5 text-[10px] font-semibold text-amber-300 shrink-0">pending review</span>
                  )}
                  {droneMatchesThisSet && droneVersion !== null && parseInt(v.version_label, 10) === droneVersion && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 leading-none whitespace-nowrap shrink-0">
                      <Usb className="h-2.5 w-2.5" />
                      on drone
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{formatDate(v.created_at)}</span>
              </div>
              {/* Second row: actions left, delete right */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {hasUpdate && v.is_latest && droneVersion !== null && parseInt(v.version_label, 10) > droneVersion && (
                    <ApplyUpdateButton versionId={v.id} />
                  )}
                  <Link href={`/compare?v=${v.id}`} title="View in Compare"
                    className="rounded-md border border-border bg-secondary hover:bg-secondary/80 p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    <Eye className="h-3.5 w-3.5" />
                  </Link>
                  <Link href={`/filter?load=${encodeURIComponent(storageUrl(v.storage_path))}&family=${encodeURIComponent(familyName)}&variant=${encodeURIComponent(variantName)}&client=${encodeURIComponent(clientSetName)}&version=${encodeURIComponent(v.version_label)}`}
                    title="Open in Filter"
                    className="rounded-md border border-border bg-secondary hover:bg-secondary/80 p-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                    <Filter className="h-3.5 w-3.5" />
                  </Link>
                  <button type="button" title="Download .param file"
                    onClick={() => downloadParamFile(v.storage_path, `${clientSetName}-v${v.version_label}.param`.replace(/\s+/g, "_"))}
                    className="flex items-center gap-1.5 rounded-md bg-primary/15 border border-primary/30 hover:bg-primary/25 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors cursor-pointer whitespace-nowrap">
                    <Download className="h-3.5 w-3.5" />
                    Download
                  </button>
                  {isAdmin && (
                    <button onClick={() => openClone(v)} title={`Clone version ${v.version_label}`}
                      className="rounded p-1.5 bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all cursor-pointer">
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {diffVsPrev && diffVsPrev[v.id] !== undefined && diffVsPrev[v.id] > 0 && (
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      {diffVsPrev[v.id]} param{diffVsPrev[v.id] !== 1 ? "s" : ""} changed
                    </span>
                  )}
                </div>
                {isAdmin && (
                  <button onClick={() => { setDeleteError(null); setDeleteId(v.id); }} title={`Delete version ${v.version_label}`}
                    className="rounded p-1.5 bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-all cursor-pointer shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {v.changelog && (
                <p className="mt-2 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap border-t border-border/50 pt-2">
                  {v.changelog}
                </p>
              )}
            </div>

          </div>
        ))}

        {isAdmin && (
          <div className="rounded-lg border border-dashed border-border bg-card overflow-hidden">
            {!uploadOpen ? (
              <button
                onClick={openUpload}
                className="flex w-full items-center gap-2 px-5 py-4 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors cursor-pointer"
              >
                <Upload className="h-4 w-4 shrink-0" />
                Upload new version…
              </button>
            ) : (
              <div className="px-5 py-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <p className="text-xs font-semibold text-foreground">Upload new version</p>
                  <span className="font-mono text-lg font-bold text-primary leading-none">{uploadVersionLabel}</span>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Changelog</span>
                  <textarea
                    value={uploadChangelog}
                    onChange={(e) => setUploadChangelog(e.target.value)}
                    disabled={uploading}
                    rows={2}
                    placeholder="Optional"
                    className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none disabled:opacity-40"
                  />
                </label>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Source <span className="text-destructive">*</span>
                  </span>

                  {/* Source toggle — shown whenever a drone is connected */}
                  {droneParams && droneParams.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => setUploadSource("file")}
                        className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs transition-colors cursor-pointer disabled:opacity-40 ${
                          uploadSource === "file"
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Upload className="h-3.5 w-3.5 shrink-0" />
                        From file
                      </button>
                      <button
                        type="button"
                        disabled={uploading}
                        onClick={() => setUploadSource("drone")}
                        className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-xs transition-colors cursor-pointer disabled:opacity-40 ${
                          uploadSource === "drone"
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <Usb className="h-3.5 w-3.5 shrink-0" />
                        From drone
                      </button>
                    </div>
                  )}

                  {/* File picker — only when source is file */}
                  {uploadSource === "file" && (
                    <div className="flex flex-col gap-1">
                      <input
                        type="file"
                        accept=".param"
                        disabled={uploading}
                        onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                        className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground file:mr-3 file:rounded file:border-0 file:bg-primary/20 file:px-2 file:py-1 file:text-xs file:text-primary file:cursor-pointer cursor-pointer disabled:opacity-40"
                      />
                      {uploadFile && (
                        <span className="text-xs text-muted-foreground">{uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                      )}
                    </div>
                  )}

                  {/* Drone source confirmation */}
                  {uploadSource === "drone" && droneParams && droneParams.length > 0 && (
                    <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                      <Usb className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-xs text-foreground">{droneParams.length} params from connected drone</span>
                    </div>
                  )}
                </div>

                {uploadLog.length > 0 && (
                  <div className="rounded-md border border-border bg-black/30 px-3 py-2 flex flex-col gap-0.5">
                    {uploadLog.map((entry, i) => (
                      <p key={i} className={`font-mono text-[11px] leading-relaxed ${entry.error ? "text-destructive" : "text-muted-foreground"}`}>
                        <span className="text-muted-foreground/50 mr-1.5">›</span>{entry.text}
                      </p>
                    ))}
                    {uploading && (
                      <p className="font-mono text-[11px] text-muted-foreground/50 animate-pulse">
                        <span className="mr-1.5">›</span>…
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button onClick={() => { setUploadOpen(false); setUploadLog([]); }} disabled={uploading} className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-40 whitespace-nowrap">Cancel</button>
                  <button
                    onClick={handleUpload}
                    disabled={uploadDisabled || uploadHasError}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {uploading ? "Uploading…" : "Upload"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Delete version modal ───────────────────────────── */}
      {deleteId && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !deleting && setDeleteId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h2 className="text-sm font-bold text-foreground">Delete version</h2>
              </div>
              <button onClick={() => setDeleteId(null)} disabled={deleting} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-40">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              <p className="text-sm text-foreground">
                Delete version <span className="font-mono font-semibold">{deleteTarget.version_label}</span>?
              </p>
              <p className="text-xs text-muted-foreground">
                The .param file and all associated data will be permanently removed. This cannot be undone.
              </p>
              {deleteError && (
                <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-3 py-2">{deleteError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-toolbar px-5 py-3">
              <button onClick={() => setDeleteId(null)} disabled={deleting} className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-40">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Clone version modal ────────────────────────────── */}
      {cloneId && cloneTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !cloning && setCloneId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Clone version</h2>
              </div>
              <button onClick={() => setCloneId(null)} disabled={cloning} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-40">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-3">
              {/* Family */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Family</span>
                <select
                  value={cloneFamilyId}
                  onChange={(e) => setCloneFamilyId(e.target.value)}
                  disabled={cloning}
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer disabled:opacity-40"
                >
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </label>

              {/* Variant */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Variant</span>
                <select
                  value={cloneVariantId}
                  onChange={(e) => setCloneVariantId(e.target.value)}
                  disabled={cloning || variants.length === 0}
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer disabled:opacity-40"
                >
                  {variants.length === 0 && <option value="">No variants</option>}
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </label>

              {/* Client set */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Client + drone</span>
                <select
                  value={cloneClientSetId}
                  onChange={(e) => {
                    setCloneClientSetId(e.target.value);
                    if (e.target.value === NEW_DEFAULT) setCloneVersionLabel("1");
                  }}
                  disabled={cloning}
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer disabled:opacity-40"
                >
                  {clientSets.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.client_name}{c.serial ? ` · ${c.serial}` : ""}
                    </option>
                  ))}
                  {!clientSets.some((c) => c.is_default) && (
                    <option value={NEW_DEFAULT}>＋ Create new Default param set…</option>
                  )}
                  <option value={NEW_CLIENT_SET}>＋ Create new client + drone…</option>
                </select>
              </label>

              {isNewClientSet && (
                <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-secondary/50 px-3.5 py-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Client <span className="text-destructive">*</span></span>
                    <input
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      disabled={cloning}
                      placeholder="e.g. Acme Corp"
                      className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Serial <span className="text-destructive">*</span></span>
                    <input
                      value={newSerial}
                      onChange={(e) => setNewSerial(e.target.value)}
                      disabled={cloning}
                      placeholder="e.g. SN-12345"
                      className="rounded-md border border-border bg-card px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Description</span>
                    <input
                      value={newClientSetDescription}
                      onChange={(e) => setNewClientSetDescription(e.target.value)}
                      disabled={cloning}
                      placeholder="Optional"
                      className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                    />
                  </label>
                </div>
              )}

              {/* Version label */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Version label <span className="text-destructive">*</span></span>
                <input
                  value={cloneVersionLabel}
                  onChange={(e) => setCloneVersionLabel(e.target.value)}
                  disabled={cloning}
                  placeholder="e.g. 1"
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                />
                {cloneVersionLabel.trim() && !versionLabelValid && (
                  <p className="text-xs text-destructive mt-0.5">Must be a whole number (e.g. 1)</p>
                )}
              </label>

              {/* Changelog */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Changelog</span>
                <textarea
                  value={cloneChangelog}
                  onChange={(e) => setCloneChangelog(e.target.value)}
                  disabled={cloning}
                  rows={3}
                  placeholder="Optional"
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring resize-none disabled:opacity-40"
                />
              </label>

              {cloneError && (
                <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-3 py-2">{cloneError}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border bg-toolbar px-5 py-3">
              <button onClick={() => setCloneId(null)} disabled={cloning} className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-40">Cancel</button>
              <button
                onClick={handleClone}
                disabled={cloneDisabled}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Copy className="h-3.5 w-3.5" />
                {cloning ? "Cloning…" : "Clone"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
