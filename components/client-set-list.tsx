"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Pencil, Plus, X, AlertTriangle, Check } from "lucide-react";

interface ClientSetRow {
  id: string;
  name: string;
  description: string | null;
  updated_at: string;
  param_versions?: { version_label: string; created_at: string }[];
}

interface Props {
  familySlug: string;
  variantId: string;
  clientSets: ClientSetRow[];
  isAdmin: boolean;
  canCreate: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function ClientSetList({ familySlug, variantId, clientSets, isAdmin, canCreate }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── Delete state ──────────────────────────────────────────
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Edit state ────────────────────────────────────────────
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ── Create state ──────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const confirmTarget = clientSets.find((c) => c.id === confirmId);
  const editTarget = clientSets.find((c) => c.id === editId);

  function resetAdd() {
    setShowAdd(false);
    setNewName("");
    setNewDescription("");
    setCreateError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    setCreateError(null);
    const res = await fetch("/api/admin/client-sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, name: newName.trim(), description: newDescription.trim() || null }),
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

  function openEdit(c: ClientSetRow) {
    setEditError(null);
    setEditName(c.name);
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
      body: JSON.stringify({ name: editName, description: editDescription }),
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

  return (
    <>
      <div className="flex flex-col gap-3">
        {clientSets.map((c) => (
          <div key={c.id} className="relative group/row">
            <Link
              href={`/${familySlug}/${variantId}/${c.id}`}
              className={`group flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4 hover:border-primary/50 transition-colors cursor-pointer${isAdmin ? " pr-20" : ""}`}
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                  {c.name}
                </span>
                {c.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>
                )}
                <span className="text-xs text-muted-foreground mt-1">
                  Updated {formatDate(c.updated_at)}
                </span>
                {c.param_versions && c.param_versions.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Versions: {[...c.param_versions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).map((v) => v.version_label).join(", ")}
                  </span>
                )}
              </div>
            </Link>

            {isAdmin && (
              <>
                <button
                  onClick={() => openEdit(c)}
                  title={`Edit ${c.name}`}
                  className="absolute top-1/2 -translate-y-1/2 right-10 rounded p-1.5 opacity-0 group-hover/row:opacity-100 bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => { setDeleteError(null); setConfirmId(c.id); }}
                  title={`Delete client set: ${c.name}`}
                  className="absolute top-1/2 -translate-y-1/2 right-3 rounded p-1.5 opacity-0 group-hover/row:opacity-100 bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        ))}

        {canCreate && !showAdd && (
          <button
            onClick={() => { setShowAdd(true); if (clientSets.length === 0) setNewName("Default"); }}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/30 px-5 py-4 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add client set
          </button>
        )}

        {canCreate && showAdd && (
          <form
            onSubmit={handleCreate}
            className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-card px-5 py-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">New client set</span>
              <button
                type="button"
                onClick={resetAdd}
                disabled={submitting}
                className="text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <input
              required
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={submitting}
              placeholder="Name (e.g. Acme Corp)"
              className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
            />
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
              disabled={submitting || !newName.trim()}
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
                <h2 className="text-sm font-bold text-foreground">Edit client set</h2>
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
                <span className="text-xs font-medium text-muted-foreground">Name <span className="text-destructive">*</span></span>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={saving}
                  className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
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
                disabled={saving || !editName.trim()}
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
                <h2 className="text-sm font-bold text-foreground">Delete client set</h2>
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
                Delete <span className="font-semibold">{confirmTarget.name}</span>?
              </p>
              <p className="text-xs text-muted-foreground">
                All versions and uploaded files in this client set will be permanently removed. This cannot be undone.
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
