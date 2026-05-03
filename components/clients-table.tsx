"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Trash2, Plus, X, Pencil, Check } from "lucide-react";

export interface ClientWithDrones {
  id: string;
  name: string;
  drones: { id: string; serial: string }[];
}

interface Props {
  clients: ClientWithDrones[];
}

export function ClientsTable({ clients }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── Row expansion ─────────────────────────────────────────
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Create client ────────────────────────────────────────
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [submittingClient, setSubmittingClient] = useState(false);
  const [createClientError, setCreateClientError] = useState<string | null>(null);

  async function handleCreateClient(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientName.trim()) return;
    setSubmittingClient(true);
    setCreateClientError(null);
    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newClientName.trim() }),
    });
    setSubmittingClient(false);
    if (res.ok) {
      setShowAddClient(false);
      setNewClientName("");
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setCreateClientError(msg ?? "Create failed");
    }
  }

  // ── Edit client name ─────────────────────────────────────
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editClientName, setEditClientName] = useState("");
  const [savingClient, setSavingClient] = useState(false);
  const [editClientErrors, setEditClientErrors] = useState<Record<string, string>>({});

  function startEditClient(c: ClientWithDrones) {
    setEditingClientId(c.id);
    setEditClientName(c.name);
    setEditClientErrors((prev) => { const n = { ...prev }; delete n[c.id]; return n; });
  }

  async function handleSaveClient(id: string, e: React.FormEvent) {
    e.preventDefault();
    if (!editClientName.trim()) return;
    setSavingClient(true);
    const res = await fetch(`/api/admin/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editClientName.trim() }),
    });
    setSavingClient(false);
    if (res.ok) {
      setEditingClientId(null);
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setEditClientErrors((prev) => ({ ...prev, [id]: msg ?? "Save failed" }));
    }
  }

  // ── Delete client ────────────────────────────────────────
  const [deleteClientErrors, setDeleteClientErrors] = useState<Record<string, string>>({});

  async function handleDeleteClient(id: string) {
    setDeleteClientErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    const res = await fetch(`/api/admin/clients/${id}`, { method: "DELETE" });
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setDeleteClientErrors((prev) => ({ ...prev, [id]: msg ?? "Cannot delete" }));
    }
  }

  // ── Add drone (per client) ───────────────────────────────
  const [addingDroneFor, setAddingDroneFor] = useState<string | null>(null);
  const [newDroneSerial, setNewDroneSerial] = useState("");
  const [submittingDrone, setSubmittingDrone] = useState(false);
  const [addDroneErrors, setAddDroneErrors] = useState<Record<string, string>>({});

  async function handleAddDrone(clientId: string, e: React.FormEvent) {
    e.preventDefault();
    if (!newDroneSerial.trim()) return;
    setSubmittingDrone(true);
    setAddDroneErrors((prev) => { const n = { ...prev }; delete n[clientId]; return n; });
    const res = await fetch(`/api/admin/clients/${clientId}/drones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serial: newDroneSerial.trim() }),
    });
    setSubmittingDrone(false);
    if (res.ok) {
      setAddingDroneFor(null);
      setNewDroneSerial("");
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setAddDroneErrors((prev) => ({ ...prev, [clientId]: msg ?? "Add failed" }));
    }
  }

  // ── Delete drone ─────────────────────────────────────────
  const [deleteDroneErrors, setDeleteDroneErrors] = useState<Record<string, string>>({});

  async function handleDeleteDrone(droneId: string) {
    setDeleteDroneErrors((prev) => { const n = { ...prev }; delete n[droneId]; return n; });
    const res = await fetch(`/api/admin/drones/${droneId}`, { method: "DELETE" });
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setDeleteDroneErrors((prev) => ({ ...prev, [droneId]: msg ?? "Cannot delete" }));
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/50 text-xs text-muted-foreground">
            <th className="px-3 py-2.5 text-left font-medium w-8"></th>
            <th className="px-3 py-2.5 text-left font-medium">Name</th>
            <th className="px-3 py-2.5 text-left font-medium w-32">Drones</th>
            <th className="px-3 py-2.5 text-right font-medium w-24"></th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c) => {
            const isExpanded = expanded.has(c.id);
            const isEditing = editingClientId === c.id;
            const isAdding = addingDroneFor === c.id;
            const editError = editClientErrors[c.id];
            const deleteError = deleteClientErrors[c.id];
            const addError = addDroneErrors[c.id];

            return (
              <Fragment key={c.id}>
                {/* Client row */}
                <tr className="border-b border-border hover:bg-secondary/30 group/row">
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggleExpanded(c.id)}
                      title={isExpanded ? "Collapse" : "Expand"}
                      className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <form
                        onSubmit={(e) => handleSaveClient(c.id, e)}
                        className="flex items-center gap-2"
                      >
                        <input
                          required
                          autoFocus
                          value={editClientName}
                          onChange={(e) => setEditClientName(e.target.value)}
                          disabled={savingClient}
                          className="flex-1 rounded-md border border-primary/40 bg-secondary px-2.5 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                        />
                        <button
                          type="submit"
                          disabled={savingClient || !editClientName.trim()}
                          title="Save"
                          className="rounded-md bg-primary p-1.5 text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingClientId(null)}
                          disabled={savingClient}
                          title="Cancel"
                          className="rounded-md border border-border p-1.5 text-muted-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-40"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    ) : (
                      <span
                        onClick={() => toggleExpanded(c.id)}
                        className="font-medium text-foreground cursor-pointer"
                      >
                        {c.name}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {c.drones.length}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {!isEditing && (
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEditClient(c)}
                          title={`Rename ${c.name}`}
                          className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(c.id)}
                          title={`Delete ${c.name}`}
                          className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>

                {/* Inline error messages for this client */}
                {(editError || deleteError) && (
                  <tr className="border-b border-border bg-destructive/5">
                    <td colSpan={4} className="px-3 py-1.5">
                      <p className="text-xs text-destructive">
                        {editError ?? deleteError}
                      </p>
                    </td>
                  </tr>
                )}

                {/* Expanded: drone rows */}
                {isExpanded && (
                  <>
                    {c.drones.map((d) => (
                      <tr key={d.id} className="border-b border-border bg-secondary/15 group/drone">
                        <td className="px-3 py-1.5"></td>
                        <td className="px-3 py-1.5 pl-8">
                          <span className="font-mono text-xs text-foreground">{d.serial}</span>
                        </td>
                        <td className="px-3 py-1.5"></td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            onClick={() => handleDeleteDrone(d.id)}
                            title={`Delete drone ${d.serial}`}
                            className="rounded p-1 opacity-0 group-hover/drone:opacity-100 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {/* Drone delete errors */}
                    {c.drones.map((d) =>
                      deleteDroneErrors[d.id] ? (
                        <tr key={`err-${d.id}`} className="border-b border-border bg-destructive/5">
                          <td colSpan={4} className="px-3 py-1.5 pl-8">
                            <p className="text-xs text-destructive">{deleteDroneErrors[d.id]}</p>
                          </td>
                        </tr>
                      ) : null
                    )}

                    {/* Add drone row */}
                    {isAdding ? (
                      <tr className="border-b border-border bg-secondary/15">
                        <td className="px-3 py-1.5"></td>
                        <td colSpan={3} className="px-3 py-1.5 pl-8">
                          <form
                            onSubmit={(e) => handleAddDrone(c.id, e)}
                            className="flex items-center gap-2"
                          >
                            <input
                              required
                              autoFocus
                              value={newDroneSerial}
                              onChange={(e) => setNewDroneSerial(e.target.value)}
                              disabled={submittingDrone}
                              placeholder="Serial (e.g. SN-12345)"
                              className="flex-1 max-w-xs rounded-md border border-primary/40 bg-card px-2.5 py-1 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                            />
                            <button
                              type="submit"
                              disabled={submittingDrone || !newDroneSerial.trim()}
                              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
                            >
                              {submittingDrone ? "Adding…" : "Add"}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setAddingDroneFor(null); setNewDroneSerial(""); }}
                              disabled={submittingDrone}
                              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-40"
                            >
                              Cancel
                            </button>
                          </form>
                          {addError && (
                            <p className="text-xs text-destructive mt-1.5">{addError}</p>
                          )}
                        </td>
                      </tr>
                    ) : (
                      <tr className="border-b border-border bg-secondary/15">
                        <td className="px-3 py-1.5"></td>
                        <td colSpan={3} className="px-3 py-1.5 pl-8">
                          <button
                            onClick={() => { setAddingDroneFor(c.id); setNewDroneSerial(""); }}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                            Add drone
                          </button>
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </Fragment>
            );
          })}

          {/* Add client row */}
          {showAddClient ? (
            <tr className="bg-secondary/15">
              <td className="px-3 py-2"></td>
              <td colSpan={3} className="px-3 py-2">
                <form onSubmit={handleCreateClient} className="flex items-center gap-2">
                  <input
                    required
                    autoFocus
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    disabled={submittingClient}
                    placeholder="Client name (e.g. Acme Corp)"
                    className="flex-1 max-w-md rounded-md border border-primary/40 bg-card px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                  />
                  <button
                    type="submit"
                    disabled={submittingClient || !newClientName.trim()}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed"
                  >
                    {submittingClient ? "Creating…" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowAddClient(false); setNewClientName(""); setCreateClientError(null); }}
                    disabled={submittingClient}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-40"
                  >
                    Cancel
                  </button>
                </form>
                {createClientError && (
                  <p className="text-xs text-destructive mt-1.5">{createClientError}</p>
                )}
              </td>
            </tr>
          ) : (
            <tr className="bg-secondary/15 hover:bg-secondary/30 cursor-pointer" onClick={() => setShowAddClient(true)}>
              <td className="px-3 py-2"></td>
              <td colSpan={3} className="px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Plus className="h-3.5 w-3.5" />
                  Add client
                </span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
