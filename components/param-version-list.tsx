"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Filter, Download, Trash2, Copy, X, AlertTriangle, Upload, Eye } from "lucide-react";

interface ParamVersionRow {
  id: string;
  version_label: string;
  storage_path: string;
  changelog: string | null;
  created_at: string;
  is_latest: boolean;
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
}

interface Props {
  versions: ParamVersionRow[];
  familySlug: string;
  familyId: string;
  variantId: string;
  clientSetId: string;
  isAdmin: boolean;
  familyName: string;
  variantName: string;
  clientSetName: string;
}

const NEW_CLIENT_SET = "__new__";

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
  familyName,
  variantName,
  clientSetName,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── Delete state ──────────────────────────────────────────
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Upload state ──────────────────────────────────────────
  const [uploadOpen, setUploadOpen] = useState(false);
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
    setUploadLog([]);
    setUploadOpen(true);
  }

  async function handleUpload() {
    if (!uploadFile || !uploadVersionLabel) return;
    setUploading(true);
    setUploadLog([]);

    const fd = new FormData();
    fd.set("clientSetId", clientSetId);
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
    setCloneFamilyId(familyId);
    setCloneVariantId(variantId);
    setCloneClientSetId(clientSetId);
    setCloneVersionLabel(v.version_label);
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
    const res = await fetch(`/api/admin/param-versions/${cloneId}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantId: cloneVariantId,
        clientSetId: isNewClientSet ? null : cloneClientSetId,
        newClientSet: isNewClientSet ? { clientName: newClientName, serial: newSerial, description: newClientSetDescription } : undefined,
        versionLabel: cloneVersionLabel,
        changelog: cloneChangelog,
      }),
    });
    if (res.ok) {
      setCloneId(null);
      setCloning(false);
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

  const uploadDisabled = uploading || !uploadFile;
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
                    href={`/compare?v=${v.id}`}
                    className="flex items-center gap-1.5 rounded-md bg-secondary border border-border hover:bg-secondary/80 px-3 py-1.5 text-xs font-medium text-foreground transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </Link>
                  <Link
                    href={`/filter?load=${encodeURIComponent(storageUrl(v.storage_path))}&family=${encodeURIComponent(familyName)}&variant=${encodeURIComponent(variantName)}&client=${encodeURIComponent(clientSetName)}&version=${encodeURIComponent(v.version_label)}`}
                    className="flex items-center gap-1.5 rounded-md bg-secondary border border-border hover:bg-secondary/80 px-3 py-1.5 text-xs font-medium text-foreground transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    Open in Filter
                  </Link>
                  <button
                    type="button"
                    onClick={() => downloadParamFile(v.storage_path, `${clientSetName}-v${v.version_label}.param`.replace(/\s+/g, "_"))}
                    className="flex items-center gap-1.5 rounded-md bg-primary/15 border border-primary/30 hover:bg-primary/25 px-3 py-1.5 text-xs font-medium text-primary transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download .param
                  </button>
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
                  onChange={(e) => setCloneClientSetId(e.target.value)}
                  disabled={cloning}
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer disabled:opacity-40"
                >
                  {clientSets.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.client_name}{c.serial ? ` · ${c.serial}` : ""}
                    </option>
                  ))}
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
