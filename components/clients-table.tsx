"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";

export interface ClientRow {
  id: string;
  name: string;
  drones: number;
  users: number;
}

/** Client companies. Their drones are managed on the Drones list, filtered by client. */
export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const newId = useId();
  const editId = useId();

  async function call(key: string, url: string, method: string, body?: object): Promise<boolean> {
    setBusy(key);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({})) as { error?: string };
      setError(b.error ?? "That did not work");
      return false;
    }
    startTransition(() => router.refresh());
    return true;
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={async (e) => { e.preventDefault(); if (await call("add", "/api/admin/clients", "POST", { name: newName.trim() })) setNewName(""); }}
        className="flex items-center gap-2"
      >
        <label htmlFor={newId} className="sr-only">New client name</label>
        <input
          id={newId}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New client name"
          className="flex-1 max-w-xs rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
        />
        <BusyButton type="submit" busy={busy === "add"} busyLabel="Adding…" disabled={!newName.trim()} icon={<Plus className="h-3.5 w-3.5" />} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          Add client
        </BusyButton>
      </form>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 text-left font-semibold">Client</th>
              <th className="px-4 py-2 text-left font-semibold">Drones</th>
              <th className="px-4 py-2 text-left font-semibold hidden sm:table-cell">Users</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {clients.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-2.5">
                  {editing === c.id ? (
                    <form
                      onSubmit={async (e) => { e.preventDefault(); if (await call(c.id, `/api/admin/clients/${c.id}`, "PATCH", { name: editName.trim() })) setEditing(null); }}
                      className="flex items-center gap-1.5"
                    >
                      <label htmlFor={editId} className="sr-only">Client name</label>
                      <input id={editId} value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-md border border-border bg-secondary px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" />
                      <BusyButton type="submit" busy={busy === c.id} aria-label="Save name" icon={<Check className="h-3.5 w-3.5" />} className="rounded p-1 text-primary hover:bg-secondary" />
                      <button type="button" aria-label="Cancel" onClick={() => setEditing(null)} className="rounded p-1 text-muted-foreground hover:bg-secondary cursor-pointer"><X className="h-3.5 w-3.5" /></button>
                    </form>
                  ) : (
                    <span className="text-foreground">{c.name}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs">
                  {c.drones > 0
                    ? <Link href={`/?client=${c.id}`} className="text-primary hover:underline cursor-pointer whitespace-nowrap">{c.drones} drone{c.drones === 1 ? "" : "s"} →</Link>
                    : <span className="text-muted-foreground">None</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{c.users}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <button type="button" aria-label={`Rename ${c.name}`} onClick={() => { setEditing(c.id); setEditName(c.name); }} className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <BusyButton
                      type="button"
                      busy={busy === `del-${c.id}`}
                      disabled={c.drones > 0}
                      aria-label={`Delete ${c.name}`}
                      title={c.drones > 0 ? "Move or delete its drones first" : `Delete ${c.name}`}
                      onClick={() => call(`del-${c.id}`, `/api/admin/clients/${c.id}`, "DELETE")}
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-secondary"
                    />
                  </div>
                </td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-muted-foreground">No clients yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
