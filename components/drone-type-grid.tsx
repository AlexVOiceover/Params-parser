"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Trash2, Plus, X } from "lucide-react";

interface DroneTypeRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  param_set_count: number;
}

interface Props {
  droneTypes: DroneTypeRow[];
  isAdmin: boolean;
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/, "");
}

export function DroneTypeGrid({ droneTypes, isAdmin }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  function resetAdd() {
    setShowAdd(false);
    setNewName("");
    setNewDescription("");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    const res = await fetch("/api/admin/drone-types", {
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
    const res = await fetch(`/api/admin/drone-types/${id}`, { method: "DELETE" });
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      const { error } = await res.json();
      setDeleteErrors((prev) => ({ ...prev, [id]: error ?? "Cannot delete" }));
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {droneTypes.map((dt) => (
        <div key={dt.id} className="relative group/card flex flex-col gap-1">
          <Link
            href={`/catalog/${dt.slug}`}
            className={`flex flex-col gap-2 rounded-lg border border-border bg-card p-5 hover:border-primary/50 hover:bg-card/80 transition-colors cursor-pointer${isAdmin ? " pr-10" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold text-foreground group-hover/card:text-primary transition-colors">
                {dt.name}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover/card:text-primary transition-colors" />
            </div>
            {dt.description && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {dt.description}
              </p>
            )}
            <div className="mt-auto pt-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground">
                {dt.param_set_count === 0
                  ? "No param sets yet"
                  : `${dt.param_set_count} param set${dt.param_set_count === 1 ? "" : "s"}`}
              </span>
            </div>
          </Link>

          {isAdmin && (
            <button
              onClick={() => handleDelete(dt.id)}
              disabled={dt.param_set_count > 0}
              title={
                dt.param_set_count > 0
                  ? `Cannot delete — ${dt.param_set_count} param set${dt.param_set_count === 1 ? "" : "s"} exist`
                  : `Delete ${dt.name}`
              }
              className="absolute top-2.5 right-2.5 rounded p-1 opacity-0 group-hover/card:opacity-100 bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-all cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          {deleteErrors[dt.id] && (
            <p className="text-xs text-destructive-foreground bg-destructive/20 border border-destructive/40 rounded-md px-2.5 py-1.5">
              {deleteErrors[dt.id]}
            </p>
          )}
        </div>
      ))}

      {isAdmin && !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/30 p-5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors cursor-pointer min-h-28"
        >
          <Plus className="h-4 w-4" />
          Add drone type
        </button>
      )}

      {isAdmin && showAdd && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-card p-5"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">New drone type</span>
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
