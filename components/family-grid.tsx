"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Plus, X, Pencil, Usb } from "lucide-react";
import { ConnectedDroneCard } from "@/components/connected-drone-card";
import { useConnectedDroneMatch } from "@/lib/use-connected-drone-match";

interface FamilyRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  variant_count: number;
}

interface Props {
  families: FamilyRow[];
  isAdmin: boolean;
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/, "");
}

export function FamilyGrid({ families, isAdmin }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const match = useConnectedDroneMatch();
  const connectedFamilySlug = match.status === "matched" ? match.drone?.family_slug ?? null : null;
  const updateAvailableForFamily = connectedFamilySlug !== null && match.versionStatus === "update_available";
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function startEdit(f: FamilyRow) {
    setEditingId(f.id);
    setEditName(f.name);
    setEditDescription(f.description ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;
    setEditSaving(true);
    const res = await fetch(`/api/admin/families/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() || null }),
    });
    setEditSaving(false);
    if (res.ok) {
      setEditingId(null);
      startTransition(() => router.refresh());
    }
  }

  function resetAdd() {
    setShowAdd(false);
    setNewName("");
    setNewDescription("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/admin/families", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), description: newDescription.trim() || null }),
    });
    setSubmitting(false);
    if (res.ok) {
      resetAdd();
      startTransition(() => router.refresh());
    }
  }

  async function handleDelete(id: string) {
    setDeleteErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    const res = await fetch(`/api/admin/families/${id}`, { method: "DELETE" });
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      const { error } = await res.json();
      setDeleteErrors((prev) => ({ ...prev, [id]: error ?? "Cannot delete" }));
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <ConnectedDroneCard />
      {families.map((f) =>
        editingId === f.id ? (
          <form
            key={f.id}
            onSubmit={handleEdit}
            className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-card p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Edit family</span>
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
            <input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={editSaving || !editName.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {editSaving ? "Saving…" : "Save"}
            </button>
          </form>
        ) : (
          <div key={f.id} className="relative group/card flex flex-col gap-1">
            <Link
              href={`/${f.slug}`}
              className={`flex flex-col gap-2 rounded-lg border bg-card p-5 hover:border-primary/50 hover:bg-card/80 transition-colors cursor-pointer ${
                connectedFamilySlug === f.slug
                  ? "border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/40"
                  : "border-border"
              }${isAdmin ? " pr-10" : ""}`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground group-hover/card:text-primary transition-colors">
                  {f.name}
                </span>
                {connectedFamilySlug === f.slug && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 leading-none whitespace-nowrap">
                    <Usb className="h-2.5 w-2.5" />
                    your drone
                  </span>
                )}
                {connectedFamilySlug === f.slug && updateAvailableForFamily && (
                  <span className="flex items-center gap-1 animate-pulse rounded-full bg-amber-500/15 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 leading-none whitespace-nowrap">
                    Update available
                  </span>
                )}
              </div>
              {f.description && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {f.description}
                </p>
              )}
              <div className="mt-auto pt-3 border-t border-border/50">
                <span className="text-xs text-muted-foreground">
                  {f.variant_count === 0
                    ? "No variants yet"
                    : `${f.variant_count} variant${f.variant_count === 1 ? "" : "s"}`}
                </span>
              </div>
            </Link>

            {isAdmin && (
              <div className="absolute top-2.5 right-2.5 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-all">
                <button
                  onClick={() => startEdit(f)}
                  title={`Edit ${f.name}`}
                  className="rounded p-1 bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(f.id)}
                  disabled={f.variant_count > 0}
                  title={
                    f.variant_count > 0
                      ? `Cannot delete — ${f.variant_count} variant${f.variant_count === 1 ? "" : "s"} exist`
                      : `Delete ${f.name}`
                  }
                  className="rounded p-1 bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {deleteErrors[f.id] && (
              <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-2.5 py-1.5">
                {deleteErrors[f.id]}
              </p>
            )}
          </div>
        )
      )}

      {isAdmin && !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/30 p-5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors cursor-pointer min-h-28"
        >
          <Plus className="h-4 w-4" />
          Add family
        </button>
      )}

      {isAdmin && showAdd && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">New family</span>
            <button
              type="button"
              onClick={resetAdd}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <input
              required
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (e.g. AIR8)"
              className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
            />
            {newName.trim() && (
              <p className="text-[10px] text-muted-foreground pl-0.5">
                slug: <span className="font-mono">{toSlug(newName)}</span>
              </p>
            )}
          </div>

          <input
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description (optional)"
            className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />

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
