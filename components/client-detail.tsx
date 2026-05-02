"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, X, Plus, Trash2 } from "lucide-react";

interface ClientRow {
  id: string;
  name: string;
}

interface DroneRow {
  id: string;
  serial: string;
}

interface Props {
  client: ClientRow;
  drones: DroneRow[];
}

export function ClientDetail({ client, drones }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── Rename client ─────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(client.name);
  const [saving, setSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim() === client.name) {
      setEditing(false);
      setName(client.name);
      return;
    }
    setSaving(true);
    setRenameError(null);
    const res = await fetch(`/api/admin/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setRenameError(msg ?? "Save failed");
    }
  }

  // ── Add drone ────────────────────────────────────────────
  const [showAdd, setShowAdd] = useState(false);
  const [newSerial, setNewSerial] = useState("");
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newSerial.trim()) return;
    setSubmittingAdd(true);
    setAddError(null);
    const res = await fetch(`/api/admin/clients/${client.id}/drones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serial: newSerial.trim() }),
    });
    setSubmittingAdd(false);
    if (res.ok) {
      setShowAdd(false);
      setNewSerial("");
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setAddError(msg ?? "Add failed");
    }
  }

  // ── Delete drone ─────────────────────────────────────────
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({});

  async function handleDeleteDrone(droneId: string) {
    setDeleteErrors((prev) => { const n = { ...prev }; delete n[droneId]; return n; });
    const res = await fetch(`/api/admin/drones/${droneId}`, { method: "DELETE" });
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setDeleteErrors((prev) => ({ ...prev, [droneId]: msg ?? "Cannot delete" }));
    }
  }

  return (
    <>
      {/* Client name (editable) */}
      <div className="flex items-start gap-3 mb-8">
        {editing ? (
          <form onSubmit={handleRename} className="flex items-center gap-2 flex-1">
            <input
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              className="flex-1 rounded-md border border-primary/40 bg-secondary px-3 py-2 text-xl font-semibold text-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={saving || !name.trim()}
              title="Save"
              className="rounded-md bg-primary p-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => { setEditing(false); setName(client.name); setRenameError(null); }}
              disabled={saving}
              title="Cancel"
              className="rounded-md border border-border p-2 text-muted-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-40"
            >
              <X className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2 group/name">
            <h1 className="text-xl font-semibold text-foreground">{client.name}</h1>
            <button
              onClick={() => setEditing(true)}
              title="Rename client"
              className="opacity-0 group-hover/name:opacity-100 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {renameError && (
        <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-3 py-2 mb-4">
          {renameError}
        </p>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Drones{drones.length > 0 ? ` (${drones.length})` : ""}
        </h2>
      </div>

      <div className="flex flex-col gap-2">
        {drones.map((d) => (
          <div key={d.id} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 group/row">
              <span className="font-mono text-sm text-foreground">{d.serial}</span>
              <button
                onClick={() => handleDeleteDrone(d.id)}
                title={`Delete drone ${d.serial}`}
                className="rounded p-1 opacity-0 group-hover/row:opacity-100 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {deleteErrors[d.id] && (
              <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-2.5 py-1.5">
                {deleteErrors[d.id]}
              </p>
            )}
          </div>
        ))}

        {!showAdd && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/30 px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Add drone
          </button>
        )}

        {showAdd && (
          <form
            onSubmit={handleAdd}
            className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">New drone</span>
              <button
                type="button"
                onClick={() => { setShowAdd(false); setNewSerial(""); setAddError(null); }}
                disabled={submittingAdd}
                className="text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              required
              autoFocus
              value={newSerial}
              onChange={(e) => setNewSerial(e.target.value)}
              disabled={submittingAdd}
              placeholder="Serial (e.g. SN-12345)"
              className="rounded-md border border-border bg-secondary px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
            />
            {addError && (
              <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-3 py-2">
                {addError}
              </p>
            )}
            <button
              type="submit"
              disabled={submittingAdd || !newSerial.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {submittingAdd ? "Adding…" : "Add"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
