"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Pencil, Plus, X, AlertTriangle, Check, GitCompareArrows, CornerDownRight } from "lucide-react";

export interface ClientSetCard {
  id: string;
  client_name: string;
  serial: string;
  description: string | null;
  updated_at: string;
  versions: { version_label: string; created_at: string }[];
  latestVersionId: string | null;
  /** Number of params that differ from Default's latest version. null = unknown / no Default to compare. */
  diffCount: number | null;
  isDefault: boolean;
}

interface Props {
  familySlug: string;
  variantId: string;
  clientSets: ClientSetCard[];
  /** Latest version id of the Default client set, used for one-click compare links. */
  defaultLatestVersionId: string | null;
  isAdmin: boolean;
  canCreate: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const CLIENT_DATALIST_ID = "client-set-list-clients";

export function ClientSetList({ familySlug, variantId, clientSets, defaultLatestVersionId, isAdmin, canCreate }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Client-name suggestions for autocomplete
  const clientNames = useMemo(() => {
    const set = new Set(clientSets.map((c) => c.client_name).filter(Boolean));
    return [...set].sort();
  }, [clientSets]);

  const defaultSet = clientSets.find((c) => c.isDefault) ?? null;
  const others = clientSets.filter((c) => !c.isDefault);

  // ── Delete state ──────────────────────────────────────────
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Edit state ────────────────────────────────────────────
  const [editId, setEditId] = useState<string | null>(null);
  const [editClientName, setEditClientName] = useState("");
  const [editSerial, setEditSerial] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ── Create state ──────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const confirmTarget = clientSets.find((c) => c.id === confirmId);
  const editTarget = clientSets.find((c) => c.id === editId);

  function resetAdd() {
    setShowAdd(false);
    setNewClientName("");
    setNewSerial("");
    setNewDescription("");
    setCreateError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientName.trim() || !newSerial.trim()) return;
    setSubmitting(true);
    setCreateError(null);
    const res = await fetch("/api/admin/client-sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantId,
        clientName: newClientName.trim(),
        serial: newSerial.trim(),
        description: newDescription.trim() || null,
      }),
    });
    setSubmitting(false);
    if (res.ok) {
      resetAdd();
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setCreateError(msg ?? "Create failed");
    }
  }

  function openEdit(c: ClientSetCard) {
    setEditError(null);
    setEditClientName(c.client_name);
    setEditSerial(c.serial);
    setEditDescription(c.description ?? "");
    setEditId(c.id);
  }

  async function handleDelete() {
    if (!confirmId) return;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/admin/client-sets/${confirmId}`, { method: "DELETE" });
    if (res.ok) {
      setConfirmId(null);
      setDeleting(false);
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setDeleteError(msg ?? `Delete failed (${res.status})`);
      setDeleting(false);
    }
  }

  async function handleSave() {
    if (!editId) return;
    setSaving(true);
    setEditError(null);
    const res = await fetch(`/api/admin/client-sets/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientName: editClientName,
        serial: editSerial,
        description: editDescription,
      }),
    });
    if (res.ok) {
      setEditId(null);
      setSaving(false);
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setEditError(msg ?? "Save failed");
      setSaving(false);
    }
  }

  function renderCard(c: ClientSetCard, indented: boolean) {
    const showCompare =
      !c.isDefault &&
      c.latestVersionId !== null &&
      defaultLatestVersionId !== null;

    return (
      <div className="relative group/row">
        <Link
          href={`/${familySlug}/${variantId}/${c.id}`}
          className={`group flex items-start justify-between gap-4 rounded-lg border bg-card px-5 py-4 hover:border-primary/50 transition-colors cursor-pointer ${
            c.isDefault ? "border-primary/40 bg-primary/5" : "border-border"
          }${isAdmin ? " pr-28" : showCompare ? " pr-14" : ""}`}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
              <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                {c.client_name}
              </span>
              {c.serial && (
                <span className="font-mono text-xs text-muted-foreground truncate">· {c.serial}</span>
              )}
              {c.isDefault ? (
                <span className="rounded-full bg-primary/15 border border-primary/30 px-1.5 py-0.5 text-[10px] font-semibold text-primary leading-none">
                  base
                </span>
              ) : c.diffCount !== null ? (
                <span className="text-[10px] text-muted-foreground">
                  <span className={c.diffCount > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                    {c.diffCount}
                  </span>
                  {" param"}{c.diffCount !== 1 ? "s" : ""} differ
                </span>
              ) : c.versions.length === 0 ? (
                <span className="text-[10px] text-muted-foreground italic">no versions yet</span>
              ) : null}
            </div>
            {c.description && (
              <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>
            )}
            <span className="text-xs text-muted-foreground mt-1">
              Updated {formatDate(c.updated_at)}
            </span>
            {c.versions.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Versions: {[...c.versions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((v) => v.version_label).join(", ")}
              </span>
            )}
          </div>
        </Link>

        {showCompare && (
          <Link
            href={`/compare?v=${defaultLatestVersionId}&v=${c.latestVersionId}`}
            title={`Compare with Default (latest)`}
            className={`absolute top-1/2 -translate-y-1/2 ${isAdmin ? "right-20" : "right-3"} rounded p-1.5 bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all cursor-pointer`}
            onClick={(e) => e.stopPropagation()}
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
          </Link>
        )}

        {isAdmin && (
          <>
            <button
              onClick={() => openEdit(c)}
              title={`Edit ${c.client_name}${c.serial ? ` · ${c.serial}` : ""}`}
              className="absolute top-1/2 -translate-y-1/2 right-10 rounded p-1.5 opacity-0 group-hover/row:opacity-100 bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { setDeleteError(null); setConfirmId(c.id); }}
              title={`Delete client set: ${c.client_name}${c.serial ? ` · ${c.serial}` : ""}`}
              className="absolute top-1/2 -translate-y-1/2 right-3 rounded p-1.5 opacity-0 group-hover/row:opacity-100 bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-all cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {indented && (
          <CornerDownRight className="absolute -left-5 top-5 h-3.5 w-3.5 text-muted-foreground/50 pointer-events-none" />
        )}
      </div>
    );
  }

  return (
    <>
      <datalist id={CLIENT_DATALIST_ID}>
        {clientNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="flex flex-col gap-3">
        {defaultSet && renderCard(defaultSet, false)}

        {others.length > 0 && (
          <div className="flex flex-col gap-2 ml-6 pl-2 border-l-2 border-border">
            {others.map((c) => (
              <div key={c.id}>{renderCard(c, true)}</div>
            ))}
          </div>
        )}

        {/* If there's no Default, render others flat */}
        {!defaultSet && others.map((c) => (
          <div key={c.id}>{renderCard(c, false)}</div>
        ))}

        {canCreate && !showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/30 px-5 py-4 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add client + drone
          </button>
        )}

        {canCreate && showAdd && (
          <form
            onSubmit={handleCreate}
            className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-card px-5 py-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">New client + drone</span>
              <button
                type="button"
                onClick={resetAdd}
                disabled={submitting}
                className="text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Client <span className="text-destructive">*</span></span>
              <input
                required
                autoFocus
                list={CLIENT_DATALIST_ID}
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                disabled={submitting}
                placeholder="e.g. Acme Corp"
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">Serial <span className="text-destructive">*</span></span>
              <input
                required
                value={newSerial}
                onChange={(e) => setNewSerial(e.target.value)}
                disabled={submitting}
                placeholder="e.g. SN-12345"
                className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
              />
            </label>
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              disabled={submitting}
              placeholder="Description (optional)"
              className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
            />
            {createError && (
              <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-3 py-2">
                {createError}
              </p>
            )}
            <button
              type="submit"
              disabled={submitting || !newClientName.trim() || !newSerial.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {submitting ? "Creating…" : "Create"}
            </button>
          </form>
        )}
      </div>

      {/* ── Edit modal ─────────────────────────────────────── */}
      {editId && editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !saving && setEditId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Pencil className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Edit client + drone</h2>
              </div>
              <button
                onClick={() => setEditId(null)}
                disabled={saving}
                className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Client <span className="text-destructive">*</span></span>
                <input
                  list={CLIENT_DATALIST_ID}
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  disabled={saving}
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Serial <span className="text-destructive">*</span></span>
                <input
                  value={editSerial}
                  onChange={(e) => setEditSerial(e.target.value)}
                  disabled={saving}
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Description</span>
                <input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  disabled={saving}
                  placeholder="Optional"
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                />
              </label>
              {editError && (
                <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-3 py-2">
                  {editError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border bg-toolbar px-5 py-3">
              <button
                onClick={() => setEditId(null)}
                disabled={saving}
                className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !editClientName.trim() || !editSerial.trim()}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                <Check className="h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ───────────────────────────── */}
      {confirmId && confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !deleting && setConfirmId(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border bg-toolbar px-5 py-3.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <h2 className="text-sm font-bold text-foreground">Delete client + drone</h2>
              </div>
              <button
                onClick={() => setConfirmId(null)}
                disabled={deleting}
                className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 flex flex-col gap-3">
              <p className="text-sm text-foreground">
                Delete <span className="font-semibold">{confirmTarget.client_name}{confirmTarget.serial ? ` · ${confirmTarget.serial}` : ""}</span>?
              </p>
              <p className="text-xs text-muted-foreground">
                All versions and uploaded files for this drone will be permanently removed. This cannot be undone.
              </p>
              {deleteError && (
                <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-3 py-2">
                  {deleteError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border bg-toolbar px-5 py-3">
              <button
                onClick={() => setConfirmId(null)}
                disabled={deleting}
                className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
