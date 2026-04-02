"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Filter, Download, Trash2, Copy, X, AlertTriangle, Upload } from "lucide-react";

interface ParamVersionRow {
  id: string;
  version_label: string;
  storage_path: string;
  changelog: string | null;
  created_at: string;
  is_latest: boolean;
}

interface DroneType {
  id: string;
  name: string;
}

interface ParamSetOption {
  id: string;
  name: string;
}

interface Props {
  versions: ParamVersionRow[];
  droneSlug: string;
  droneTypeId: string;
  paramSetId: string;
  isAdmin: boolean;
  droneName: string;
  paramSetName: string;
}

const NEW_PARAM_SET = "__new__";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function storageUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/param-files/${path}`;
}

function nextVersions(versions: ParamVersionRow[]): { major: string; minor: string | null } {
  const parsed = versions
    .map((v) => v.version_label.match(/^(\d+)\.(\d+)$/))
    .filter(Boolean)
    .map((m) => ({ maj: parseInt(m![1]), min: parseInt(m![2]) }));

  if (parsed.length === 0) return { major: "1.0", minor: null };

  const latest = parsed.reduce((a, b) => (a.maj > b.maj || (a.maj === b.maj && a.min > b.min) ? a : b));
  return {
    major: `${latest.maj + 1}.0`,
    minor: `${latest.maj}.${latest.min + 1}`,
  };
}

export function ParamVersionList({ versions, droneSlug, droneTypeId, paramSetId, isAdmin, droneName, paramSetName }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── Delete state ──────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Upload state ──────────────────────────────────────────
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadVersionType, setUploadVersionType] = useState<"major" | "minor" | null>(null);
  const [uploadChangelog, setUploadChangelog] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLog, setUploadLog] = useState<{ text: string; error?: boolean }[]>([]);

  // ── Clone state ───────────────────────────────────────────
  const [cloneId, setCloneId] = useState<string | null>(null);
  const [cloneDroneTypeId, setCloneDroneTypeId] = useState(droneTypeId);
  const [cloneParamSetId, setCloneParamSetId] = useState(paramSetId);
  const [cloneVersionLabel, setCloneVersionLabel] = useState("");
  const [cloneChangelog, setCloneChangelog] = useState("");
  const [newParamSetName, setNewParamSetName] = useState("");
  const [newParamSetDescription, setNewParamSetDescription] = useState("");
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState<string | null>(null);

  // ── Dropdown data ─────────────────────────────────────────
  const [droneTypes, setDroneTypes] = useState<DroneType[]>([]);
  const [paramSets, setParamSets] = useState<ParamSetOption[]>([]);

  const deleteTarget = versions.find((v) => v.id === deleteId);
  const cloneTarget = versions.find((v) => v.id === cloneId);
  const isNewParamSet = cloneParamSetId === NEW_PARAM_SET;

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/drone-types").then((r) => r.json()).then(({ droneTypes: dt }) => {
      setDroneTypes(dt ?? []);
    });
  }, [isAdmin]);

  // Reload param sets whenever the selected drone type changes
  useEffect(() => {
    if (!cloneId) return;
    setParamSets([]);
    fetch(`/api/admin/param-sets?droneTypeId=${cloneDroneTypeId}`)
      .then((r) => r.json())
      .then(({ paramSets: ps }) => {
        setParamSets(ps ?? []);
        setCloneParamSetId((prev) => {
          if (prev === NEW_PARAM_SET) return NEW_PARAM_SET;
          const stillExists = (ps ?? []).some((p: ParamSetOption) => p.id === prev);
          if (stillExists) return prev;
          return ps?.[0]?.id ?? NEW_PARAM_SET;
        });
      });
  }, [cloneDroneTypeId, cloneId]);

  const { major: nextMajor, minor: nextMinor } = nextVersions(versions);
  const uploadVersionLabel = uploadVersionType === "major" ? nextMajor : uploadVersionType === "minor" ? nextMinor! : "";

  function openUpload() {
    setUploadVersionType(nextMinor ? null : "major");
    setUploadChangelog("");
    setUploadFile(null);
    setUploadLog([]);
    setUploadOpen(true);
  }

  async function handleUpload() {
    if (!uploadFile || !uploadVersionLabel) return;
    setUploading(true);
    setUploadLog([]);

    const fd = new FormData();
    fd.set("droneTypeId", droneTypeId);
    fd.set("paramSetId", paramSetId);
    fd.set("versionLabel", uploadVersionLabel);
    if (uploadChangelog) fd.set("changelog", uploadChangelog);
    fd.set("file", uploadFile);

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
    setCloneDroneTypeId(droneTypeId);
    setCloneParamSetId(paramSetId);
    setCloneVersionLabel(v.version_label);
    setCloneChangelog(v.changelog ?? "");
    setNewParamSetName("");
    setNewParamSetDescription("");
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
      startTransition(() => router.refresh());
    } else {
      const { error: msg } = await res.json();
      setDeleteError(msg ?? "Delete failed");
      setDeleting(false);
    }
  }

  async function handleClone() {
    if (!cloneId) return;
    setCloning(true);
    setCloneError(null);
    const res = await fetch(`/api/admin/param-versions/${cloneId}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        droneTypeId: cloneDroneTypeId,
        paramSetId: isNewParamSet ? null : cloneParamSetId,
        newParamSet: isNewParamSet ? { name: newParamSetName, description: newParamSetDescription } : undefined,
        versionLabel: cloneVersionLabel,
        changelog: cloneChangelog,
      }),
    });
    if (res.ok) {
      setCloneId(null);
      setCloning(false);
      startTransition(() => router.refresh());
    } else {
      const { error: msg } = await res.json();
      setCloneError(msg ?? "Clone failed");
      setCloning(false);
    }
  }

  const versionLabelValid = /^\d+\.\d+$/.test(cloneVersionLabel.trim());
  const cloneDisabled =
    cloning ||
    !cloneVersionLabel.trim() ||
    !versionLabelValid ||
    (isNewParamSet && !newParamSetName.trim());

  const uploadDisabled = uploading || !uploadVersionType || !uploadFile;
  const uploadHasError = uploadLog.some((l) => l.error);

  return (
    <>
      <div className="flex flex-col gap-3">
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
                <p className="text-xs font-semibold text-foreground">Upload new version</p>

                {/* Version type selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => setUploadVersionType("major")}
                    className={`flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer disabled:opacity-40 ${
                      uploadVersionType === "major"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary/50 hover:border-primary/40"
                    }`}
                  >
                    <span className="text-xs font-medium text-foreground">New version</span>
                    <span className="font-mono text-lg font-bold text-foreground leading-none">{nextMajor}</span>
                    <span className="text-[10px] text-muted-foreground leading-snug">Full config overhaul</span>
                  </button>

                  {nextMinor && (
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => setUploadVersionType("minor")}
                      className={`flex flex-col items-start gap-1 rounded-lg border px-4 py-3 text-left transition-colors cursor-pointer disabled:opacity-40 ${
                        uploadVersionType === "minor"
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary/50 hover:border-primary/40"
                      }`}
                    >
                      <span className="text-xs font-medium text-foreground">Revision</span>
                      <span className="font-mono text-lg font-bold text-foreground leading-none">{nextMinor}</span>
                      <span className="text-[10px] text-muted-foreground leading-snug">Incremental update</span>
                    </button>
                  )}
                </div>

                {/* Changelog */}
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

                {/* File */}
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">.param file <span className="text-destructive">*</span></span>
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
                </label>

                {uploadLog.length > 0 && (
                  <div className="rounded-md border border-border bg-black/30 px-3 py-2 flex flex-col gap-0.5">
                    {uploadLog.map((entry, i) => (
                      <p key={i} className={`font-mono text-[11px] leading-relaxed ${entry.error ? "text-destructive-foreground" : "text-muted-foreground"}`}>
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

        {versions.length === 0 && !isAdmin && (
          <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">No versions uploaded yet.</p>
          </div>
        )}

        {versions.map((v) => (
          <div key={v.id} className="relative group/row">
            <div className={`rounded-lg border border-border bg-card px-5 py-4${isAdmin ? " pr-20" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-sm text-foreground">
                    Version <span className="font-mono font-semibold">{v.version_label}</span>
                  </span>
                  {v.is_latest && (
                    <span className="rounded-full bg-emerald-900/50 border border-emerald-700/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      latest
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{formatDate(v.created_at)}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/?load=${encodeURIComponent(storageUrl(v.storage_path))}&drone=${encodeURIComponent(droneName)}&set=${encodeURIComponent(paramSetName)}&version=${encodeURIComponent(v.version_label)}`}
                    className="flex items-center gap-1.5 rounded-md bg-secondary border border-border hover:bg-secondary/80 px-3 py-1.5 text-xs font-medium text-foreground transition-colors cursor-pointer"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Open in Filter
                  </Link>
                  <a
                    href={storageUrl(v.storage_path)}
                    download
                    className="flex items-center gap-1.5 rounded-md bg-primary/15 border border-primary/30 hover:bg-primary/25 px-3 py-1.5 text-xs font-medium text-primary transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download .param
                  </a>
                </div>
              </div>
              {v.changelog && (
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap border-t border-border/50 pt-3">
                  {v.changelog}
                </p>
              )}
            </div>

            {isAdmin && (
              <>
                <button
                  onClick={() => openClone(v)}
                  title={`Clone version ${v.version_label}`}
                  className="absolute top-1/2 -translate-y-1/2 right-10 rounded p-1.5 bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => { setDeleteError(null); setDeleteId(v.id); }}
                  title={`Delete version ${v.version_label}`}
                  className="absolute top-1/2 -translate-y-1/2 right-3 rounded p-1.5 bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        ))}
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
                <p className="text-xs text-destructive-foreground bg-destructive/30 border border-destructive/50 rounded-md px-3 py-2">{deleteError}</p>
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
              {/* Drone type */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Drone type</span>
                <select
                  value={cloneDroneTypeId}
                  onChange={(e) => setCloneDroneTypeId(e.target.value)}
                  disabled={cloning}
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer disabled:opacity-40"
                >
                  {droneTypes.map((dt) => (
                    <option key={dt.id} value={dt.id}>{dt.name}</option>
                  ))}
                </select>
              </label>

              {/* Param set */}
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Param set</span>
                <select
                  value={cloneParamSetId}
                  onChange={(e) => setCloneParamSetId(e.target.value)}
                  disabled={cloning}
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer disabled:opacity-40"
                >
                  {paramSets.map((ps) => (
                    <option key={ps.id} value={ps.id}>{ps.name}</option>
                  ))}
                  <option value={NEW_PARAM_SET}>＋ Create new param set…</option>
                </select>
              </label>

              {/* New param set fields — shown inline when "Create new param set" is selected */}
              {isNewParamSet && (
                <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-secondary/50 px-3.5 py-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Param set name <span className="text-destructive">*</span></span>
                    <input
                      value={newParamSetName}
                      onChange={(e) => setNewParamSetName(e.target.value)}
                      disabled={cloning}
                      placeholder="e.g. Survey config"
                      className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Description</span>
                    <input
                      value={newParamSetDescription}
                      onChange={(e) => setNewParamSetDescription(e.target.value)}
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
                  placeholder="e.g. 1.0"
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                />
                {cloneVersionLabel.trim() && !versionLabelValid && (
                  <p className="text-xs text-destructive mt-0.5">Must be number.number (e.g. 1.0)</p>
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
                <p className="text-xs text-destructive-foreground bg-destructive/30 border border-destructive/50 rounded-md px-3 py-2">{cloneError}</p>
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
