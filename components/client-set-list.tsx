"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2, Pencil, Plus, X, AlertTriangle, Check, GitCompareArrows, CornerDownRight, Usb } from "lucide-react";
import { useConnectedDroneMatch } from "@/lib/use-connected-drone-match";

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
  /** FK to the drone this client_set belongs to. Used to match against the connected drone. */
  droneId: string | null;
}

interface Props {
  familySlug: string;
  variantId: string;
  clientSets: ClientSetCard[];
  /** Latest version id of the Default client set, used for one-click compare links. */
  defaultLatestVersionId: string | null;
  isAdmin: boolean;
  canCreate: boolean;
  /** All registered clients, for the "add client + drone" picker. */
  clients: { id: string; name: string }[];
  /** Drones registered on this variant that don't yet have a client_set on it. */
  availableDrones: { id: string; client_id: string; serial: string }[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function ClientSetList({ familySlug, variantId, clientSets, defaultLatestVersionId, isAdmin, canCreate, clients, availableDrones }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const match = useConnectedDroneMatch();
  const connectedDroneId = match.status === "matched" ? match.drone?.id ?? null : null;

  // Only list clients that actually have an unused drone on this variant.
  const clientsWithDrones = useMemo(() => {
    const ids = new Set(availableDrones.map((d) => d.client_id));
    return clients.filter((c) => ids.has(c.id));
  }, [clients, availableDrones]);

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
  const [newClientId, setNewClientId] = useState("");
  const [newDroneId, setNewDroneId] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Create Default state ──────────────────────────────────
  const [creatingDefault, setCreatingDefault] = useState(false);
  const [createDefaultError, setCreateDefaultError] = useState<string | null>(null);

  const dronesForNewClient = useMemo(
    () => availableDrones.filter((d) => d.client_id === newClientId),
    [availableDrones, newClientId]
  );

  const confirmTarget = clientSets.find((c) => c.id === confirmId);
  const editTarget = clientSets.find((c) => c.id === editId);

  function resetAdd() {
    setShowAdd(false);
    setNewClientId("");
    setNewDroneId("");
    setNewDescription("");
    setCreateError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newClientId || !newDroneId) return;
    const client = clients.find((c) => c.id === newClientId);
    const drone = availableDrones.find((d) => d.id === newDroneId);
    if (!client || !drone) return;

    setSubmitting(true);
    setCreateError(null);
    const res = await fetch("/api/admin/client-sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantId,
        clientId: newClientId,
        droneId: newDroneId,
        clientName: client.name,
        serial: drone.serial,
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

  async function handleCreateDefault() {
    setCreatingDefault(true);
    setCreateDefaultError(null);
    const res = await fetch("/api/admin/client-sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantId,
        clientName: "Default",
        serial: "",
        isDefault: true,
      }),
    });
    setCreatingDefault(false);
    if (res.ok) {
      startTransition(() => router.refresh());
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setCreateDefaultError(msg ?? "Failed to create Default");
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
      // Keep modal open with spinner until the page refresh settles.
      startTransition(() => {
        router.refresh();
        setConfirmId(null);
        setDeleting(false);
      });
    } else {
      const msg = await res.json().then((b) => b?.error).catch(() => null);
      setDeleteError(msg ?? `Delete failed (${res.status})`);
      setDeleting(false);
    }
  }

  async function handleSave() {
    if (!editId) return;
    const target = clientSets.find((c) => c.id === editId);
    if (!target) return;
    setSaving(true);
    setEditError(null);
    const body: Record<string, string> = { description: editDescription };
    if (target.isDefault) {
      body.clientName = editClientName;
    } else {
      body.clientName = editClientName;
      body.serial = editSerial;
    }
    const res = await fetch(`/api/admin/client-sets/${editId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
    const isConnected = connectedDroneId !== null && c.droneId === connectedDroneId;
    const hasUpdate = isConnected && match.versionStatus === "update_available";

    return (
      <div className="relative group/row">
        <Link
          href={`/${familySlug}/${variantId}/${c.id}`}
          className={`group flex items-start justify-between gap-4 rounded-lg border bg-card px-5 py-4 hover:border-primary/50 transition-colors cursor-pointer ${
            isConnected
              ? "border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/40"
              : c.isDefault
              ? "border-primary/40 bg-primary/5"
              : "border-border"
          }${isAdmin ? " pr-28" : showCompare || hasUpdate ? " pr-14" : ""}`}
        >
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-baseline gap-2 min-w-0 flex-wrap">
              <span className={`font-medium group-hover:text-primary transition-colors truncate ${c.isDefault ? "text-primary text-base" : "text-foreground"}`}>
                {c.client_name}
              </span>
              {!c.isDefault && c.serial && (
                <span className="font-mono text-xs text-muted-foreground truncate">· {c.serial}</span>
              )}
              {isConnected && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 leading-none whitespace-nowrap">
                  <Usb className="h-2.5 w-2.5" />
                  this drone
                </span>
              )}
              {hasUpdate && (
                <span className="flex items-center gap-1 animate-pulse rounded-full bg-amber-500/15 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 leading-none whitespace-nowrap">
                  Update available
                </span>
              )}
              {c.isDefault ? (
                <span className="rounded-full bg-primary/15 border border-primary/30 px-1.5 py-0.5 text-[10px] font-semibold text-primary leading-none whitespace-nowrap">
                  catalog reference
                </span>
              ) : c.diffCount !== null ? (
                <span className="text-[10px] text-muted-foreground">
                  <span className={c.diffCount > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>
                    {c.diffCount}
                  </span>
                  {" param"}{c.diffCount !== 1 ? "s" : ""} differ from Default
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
            {hasUpdate && match.droneVersion !== null && match.catalogVersion !== null && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Drone has v{match.droneVersion} · Catalog has v{match.catalogVersion}
              </span>
            )}
          </div>
        </Link>

        {/* Apply update button — sits outside the Link so the click doesn't navigate */}
        {hasUpdate && c.latestVersionId && (
          <Link
            href={`/compare?v=${c.latestVersionId}`}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            Apply update
          </Link>
        )}

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
              aria-label={`Edit ${c.client_name}`}
              className="absolute top-1/2 -translate-y-1/2 right-10 rounded p-1.5 bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => { setDeleteError(null); setConfirmId(c.id); }}
              title={`Delete client set: ${c.client_name}${c.serial ? ` · ${c.serial}` : ""}`}
              aria-label={`Delete ${c.client_name}`}
              className="absolute top-1/2 -translate-y-1/2 right-3 rounded p-1.5 bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors cursor-pointer"
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
      <div className="flex flex-col gap-3">
        {defaultSet && renderCard(defaultSet, false)}

        {/* When there's a Default, indent the others as its children. */}
        {defaultSet && others.length > 0 && (
          <div className="flex flex-col gap-2 ml-6 pl-2 border-l-2 border-border">
            {others.map((c) => (
              <div key={c.id}>{renderCard(c, true)}</div>
            ))}
          </div>
        )}

        {/* No Default — render others flat. */}
        {!defaultSet && others.map((c) => (
          <div key={c.id}>{renderCard(c, false)}</div>
        ))}

        {canCreate && !showAdd && (
          <div className="flex flex-col gap-2">
            {/* Warn when there's no Default and offer to create one */}
            {!defaultSet && (
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={handleCreateDefault}
                  disabled={creatingDefault || isPending}
                  className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 px-5 py-3 text-sm text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/70 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                  {creatingDefault || isPending ? "Creating…" : "Create Default param set"}
                </button>
                {createDefaultError && (
                  <p className="text-xs text-destructive bg-destructive/15 border border-destructive/40 rounded-md px-3 py-2">{createDefaultError}</p>
                )}
              </div>
            )}
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card/30 px-5 py-4 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add client param set
            </button>
          </div>
        )}

        {canCreate && showAdd && (
          <form
            onSubmit={handleCreate}
            className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-card px-5 py-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Add client param set</span>
              <button
                type="button"
                onClick={resetAdd}
                disabled={submitting}
                className="text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {clientsWithDrones.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No drones registered for this variant.{" "}
                <Link href="/admin/clients" className="text-primary hover:underline">
                  Register one in Clients
                </Link>{" "}
                first.
              </p>
            ) : (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Client <span className="text-destructive">*</span></span>
                  <select
                    required
                    autoFocus
                    value={newClientId}
                    onChange={(e) => { setNewClientId(e.target.value); setNewDroneId(""); }}
                    disabled={submitting}
                    className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40 cursor-pointer"
                  >
                    <option value="">Select client…</option>
                    {clientsWithDrones.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>

                {newClientId && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground">Drone <span className="text-destructive">*</span></span>
                    <select
                      required
                      value={newDroneId}
                      onChange={(e) => setNewDroneId(e.target.value)}
                      disabled={submitting}
                      className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm font-mono text-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40 cursor-pointer"
                    >
                      <option value="">Select drone…</option>
                      {dronesForNewClient.map((d) => (
                        <option key={d.id} value={d.id}>{d.serial}</option>
                      ))}
                    </select>
                  </label>
                )}

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
                  disabled={submitting || !newClientId || !newDroneId}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {submitting ? "Creating…" : "Create"}
                </button>
              </>
            )}
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
                <h2 className="text-sm font-bold text-foreground">
                  {editTarget.isDefault ? "Edit Default" : "Edit client param set"}
                </h2>
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
              {editTarget.isDefault ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Name <span className="text-destructive">*</span></span>
                  <input
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                    disabled={saving}
                    placeholder="Default"
                    className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
                  />
                </label>
              ) : (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Client <span className="text-destructive">*</span></span>
                    <input
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
                </>
              )}
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
                disabled={saving || !editClientName.trim() || (!editTarget.isDefault && !editSerial.trim())}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
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
                disabled={deleting || isPending}
                className="flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:bg-destructive/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
              >
                {(deleting || isPending) && (
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin shrink-0" />
                )}
                {deleting ? "Deleting…" : isPending ? "Removing…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
