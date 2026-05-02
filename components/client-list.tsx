"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Plus, X, Pencil } from "lucide-react";

interface ClientRow {
  id: string;
  name: string;
}

interface Props {
  clients: ClientRow[];
  droneCounts: Record<string, number>;
}

export function ClientList({ clients, droneCounts }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  function startEdit(c: ClientRow) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;
    setEditSaving(true);
    setEditError(null);
    const res = await fetch(`/api/admin/clients/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditSaving(false);
    if (res.ok) {
      setEditingId(null);
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setEditError(msg ?? "Save failed");
    }
  }

  function resetAdd() {
    setShowAdd(false);
    setNewName("");
    setCreateError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    setCreateError(null);
    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
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

  async function handleDelete(id: string) {
    setDeleteErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    const res = await fetch(`/api/admin/clients/${id}`, { method: "DELETE" });
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setDeleteErrors((prev) => ({ ...prev, [id]: msg ?? "Cannot delete" }));
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {clients.map((c) =>
        editingId === c.id ? (
          <form
            key={c.id}
            onSubmit={handleEdit}
            className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Edit client</span>
              <button type="button" onClick={cancelEdit} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              required
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Name"
              className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
            />
            {editError && (
              <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-2.5 py-1.5">
                {editError}
              </p>
            )}
            <button
              type="submit"
              disabled={editSaving || !editName.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {editSaving ? "Saving…" : "Save"}
            </button>
          </form>
        ) : (
          <div key={c.id} className="relative group/card flex flex-col gap-1">
            <Link
              href={`/admin/clients/${c.id}`}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-5 hover:border-primary/50 hover:bg-card/80 transition-colors cursor-pointer pr-10"
            >
              <span className="font-semibold text-foreground group-hover/card:text-primary transition-colors truncate">
                {c.name}
              </span>
              <div className="mt-auto pt-3 border-t border-border/50">
                <span className="text-xs text-muted-foreground">
                  {(droneCounts[c.id] ?? 0) === 0
                    ? "No drones yet"
                    : `${droneCounts[c.id]} drone${droneCounts[c.id] === 1 ? "" : "s"}`}
                </span>
              </div>
            </Link>

            <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-all">
              <button
                onClick={() => startEdit(c)}
                title={`Edit ${c.name}`}
                className="rounded p-1 bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleDelete(c.id)}
                title={`Delete ${c.name}`}
                className="rounded p-1 bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {deleteErrors[c.id] && (
              <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-2.5 py-1.5">
                {deleteErrors[c.id]}
              </p>
            )}
          </div>
        )
      )}

      {!showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/30 p-5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors cursor-pointer min-h-28"
        >
          <Plus className="h-4 w-4" />
          Add client
        </button>
      )}

      {showAdd && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">New client</span>
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
  );
}
