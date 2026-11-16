"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Search, Usb, X } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { FleetStatusBadge } from "@/components/status-badge";
import { useConnectedDroneMatch } from "@/lib/use-connected-drone-match";
import { STATUS_ORDER, type FleetRow, type FleetStatus } from "@/lib/fleet";
import { droneHref } from "@/lib/versions";

export interface ModelOption { id: string; name: string; hasTemplate: boolean }
export interface ClientOption { id: string; name: string }

interface Props {
  rows: FleetRow[];
  isStaff: boolean;
  isAdmin: boolean;
  models: ModelOption[];
  clients: ClientOption[];
  initialClientId: string | null;
}

function ago(iso: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function DroneList({ rows, isStaff, isAdmin, models, clients, initialClientId }: Props) {
  const router = useRouter();
  const match = useConnectedDroneMatch();
  const connectedId = match.status === "linked" ? match.drone?.id ?? null : null;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<FleetStatus | "all">("all");
  const [clientId, setClientId] = useState<string>(initialClientId ?? "all");
  const [adding, setAdding] = useState(false);
  const [groupBy, setGroupByState] = useState<GroupBy>("none");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "status", dir: "asc" });
  const searchId = useId();
  const clientFilterId = useId();
  const groupId = useId();

  // Remember the grouping per browser; it is a viewing preference.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("air6_drones_group");
      if (saved === "model" || saved === "client") setGroupByState(saved);
    } catch {}
  }, []);
  function setGroupBy(g: GroupBy) {
    setGroupByState(g);
    try { localStorage.setItem("air6_drones_group", g); } catch {}
  }
  function toggleSort(key: SortKey) {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }));
  }

  const counts = useMemo(() => {
    const c = new Map<FleetStatus, number>();
    for (const r of rows) c.set(r.status, (c.get(r.status) ?? 0) + 1);
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) =>
      (status === "all" || r.status === status) &&
      (clientId === "all" || (clientId === "none" ? !r.clientId : r.clientId === clientId)) &&
      (!q || r.serial.toLowerCase().includes(q) || r.modelName.toLowerCase().includes(q) || (r.clientName ?? "").toLowerCase().includes(q))
    ).sort((a, b) => {
      const cmp = compareBy(sort.key, a, b);
      return sort.dir === "asc" ? cmp : -cmp;
    });
  }, [rows, query, status, clientId, sort]);

  const groups = useMemo(() => {
    if (groupBy === "none") return [{ key: "all", label: null as string | null, rows: visible }];
    const map = new Map<string, FleetRow[]>();
    for (const r of visible) {
      const key = groupBy === "model" ? r.modelName : r.clientName ?? "No client";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === "No client" ? 1 : b === "No client" ? -1 : a.localeCompare(b)))
      .map(([key, list]) => ({ key, label: key as string | null, rows: list }));
  }, [visible, groupBy]);
  const columnCount = isStaff ? 6 : 5;

  const attention = rows.filter((r) => r.status !== "up_to_date").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{isStaff ? "Drones" : "Your drones"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rows.length} drone{rows.length === 1 ? "" : "s"}
            {attention > 0 && ` · ${attention} need${attention === 1 ? "s" : ""} attention`}
          </p>
        </div>
        {isStaff && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" /> Add drone
          </button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <label htmlFor={searchId} className="sr-only">Search drones</label>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                id={searchId}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isStaff ? "Search serial, model or client…" : "Search serial or model…"}
                className="w-full rounded-md border border-border bg-secondary pl-8 pr-7 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onMouseDown={(e) => { e.preventDefault(); setQuery(""); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <label htmlFor={groupId} className="sr-only">Group by</label>
            <select
              id={groupId}
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as GroupBy)}
              className="shrink-0 rounded-md border border-border bg-secondary px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              <option value="none">No grouping</option>
              <option value="model">Group by model</option>
              {isStaff && <option value="client">Group by client</option>}
            </select>
            {isStaff && clients.length > 0 && (
              <>
                <label htmlFor={clientFilterId} className="sr-only">Client</label>
                <select
                  id={clientFilterId}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="shrink-0 rounded-md border border-border bg-secondary px-2 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                >
                  <option value="all">All clients</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="none">No client</option>
                </select>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filter by status">
            <FilterChip active={status === "all"} onClick={() => setStatus("all")}>All {rows.length}</FilterChip>
            {STATUS_ORDER.filter((s) => counts.has(s)).map((s) => (
              <FilterChip key={s} active={status === s} onClick={() => setStatus(status === s ? "all" : s)}>
                {chipLabel(s, isStaff)} {counts.get(s)}
              </FilterChip>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
          <p className="text-sm text-foreground">No drones yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isStaff ? "Add one, or connect a new drone and register it." : "No drone is registered to your account yet. Contact AIR6 to set one up."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary text-[11px] uppercase tracking-wider text-muted-foreground">
                <SortTh label="Serial" k="serial" sort={sort} onSort={toggleSort} />
                <SortTh label="Model" k="model" sort={sort} onSort={toggleSort} className="hidden sm:table-cell" />
                {isStaff && <SortTh label="Client" k="client" sort={sort} onSort={toggleSort} className="hidden md:table-cell" />}
                <SortTh label="Status" k="status" sort={sort} onSort={toggleSort} />
                <SortTh label="Target" k="target" sort={sort} onSort={toggleSort} className="hidden md:table-cell" />
                <SortTh label="Last verified" k="last" sort={sort} onSort={toggleSort} className="hidden lg:table-cell" />
              </tr>
            </thead>
            {groups.map((g) => (
            <tbody key={g.key} className="divide-y divide-border border-b border-border last:border-b-0">
              {g.label !== null && (
                <tr className="bg-secondary/60">
                  <th colSpan={columnCount} scope="colgroup" className="px-4 py-1.5 text-left text-xs font-semibold text-foreground">
                    {g.label} <span className="font-normal text-muted-foreground">· {g.rows.length}</span>
                  </th>
                </tr>
              )}
              {g.rows.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => router.push(droneHref(r.serial))}
                  className="cursor-pointer hover:bg-secondary/40 transition-colors"
                >
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Link href={droneHref(r.serial)} onClick={(e) => e.stopPropagation()} className="font-mono text-sm font-medium text-foreground hover:text-primary cursor-pointer">
                      {r.serial}
                    </Link>
                    {connectedId === r.id && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-px text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                        <Usb className="h-2.5 w-2.5" /> connected
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">{r.modelName}</td>
                  {isStaff && (
                    <td className="px-4 py-2.5 text-xs hidden md:table-cell whitespace-nowrap">
                      {r.clientName ?? <span className="text-muted-foreground italic">No client</span>}
                    </td>
                  )}
                  <td className="px-4 py-2.5"><FleetStatusBadge row={r} isStaff={isStaff} /></td>
                  <td className="px-4 py-2.5 font-mono text-xs hidden md:table-cell">{r.target ? `v${r.target}` : "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                    {r.lastLabel ? <>v{r.lastLabel} · {ago(r.lastAt)}</> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            ))}
            {visible.length === 0 && (
              <tbody><tr><td colSpan={columnCount} className="px-4 py-8 text-center text-xs text-muted-foreground">No drones match.</td></tr></tbody>
            )}
          </table>
        </div>
      )}

      {adding && (
        <AddDroneDialog
          models={models}
          clients={clients}
          isAdmin={isAdmin}
          onClose={() => setAdding(false)}
          onAdded={(serial) => router.push(droneHref(serial))}
        />
      )}
    </div>
  );
}

type GroupBy = "none" | "model" | "client";
type SortKey = "serial" | "model" | "client" | "status" | "target" | "last";

function compareBy(key: SortKey, a: FleetRow, b: FleetRow): number {
  switch (key) {
    case "serial": return a.serial.localeCompare(b.serial);
    case "model": return a.modelName.localeCompare(b.modelName) || a.serial.localeCompare(b.serial);
    case "client": return (a.clientName ?? "~").localeCompare(b.clientName ?? "~") || a.serial.localeCompare(b.serial);
    case "status": return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.serial.localeCompare(b.serial);
    case "target": return (parseInt(a.target ?? "0", 10) - parseInt(b.target ?? "0", 10)) || a.serial.localeCompare(b.serial);
    case "last": return (a.lastAt ?? "").localeCompare(b.lastAt ?? "") || a.serial.localeCompare(b.serial);
  }
}

function SortTh({ label, k, sort, onSort, className = "" }: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === k;
  const Icon = active ? (sort.dir === "asc" ? ChevronUp : ChevronDown) : null;
  return (
    <th className={`px-4 py-2 text-left font-semibold ${className}`} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => onSort(k)} className={`flex items-center gap-1 uppercase tracking-wider cursor-pointer whitespace-nowrap hover:text-foreground ${active ? "text-foreground" : ""}`}>
        {label}
        {Icon && <Icon className="h-3 w-3" />}
      </button>
    </th>
  );
}

const CHIP_LABEL: Record<FleetStatus, string> = {
  review: "To review",
  behind: "Update waiting",
  unverified: "Not checked yet",
  not_linked: "Not linked",
  no_version: "No version yet",
  up_to_date: "Up to date",
};

function chipLabel(s: FleetStatus, isStaff: boolean): string {
  return s === "review" && !isStaff ? "With AIR6" : CHIP_LABEL[s];
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors cursor-pointer whitespace-nowrap ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function AddDroneDialog({ models, clients, isAdmin, onClose, onAdded }: {
  models: ModelOption[];
  clients: ClientOption[];
  isAdmin: boolean;
  onClose: () => void;
  onAdded: (serial: string) => void;
}) {
  const [serial, setSerial] = useState("");
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [clientId, setClientId] = useState("");
  const [fromTemplate, setFromTemplate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { serial: useId(), model: useId(), client: useId(), template: useId() };
  const model = models.find((m) => m.id === modelId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/drones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serial, variantId: modelId, clientId: clientId || null, fromTemplate: fromTemplate && !!model?.hasTemplate }),
    });
    const body = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) {
      setBusy(false);
      setError(body.error ?? "Could not add the drone");
      return;
    }
    onAdded(serial.trim());
  }

  const field = "rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <form onSubmit={submit} className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">Add drone</h2>
          <button type="button" aria-label="Close" onClick={onClose} disabled={busy} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <p className="text-xs text-muted-foreground">
            To add the drone that is plugged in, connect it instead: the app reads it and links its flight controller in one go.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.serial} className="text-xs font-medium text-muted-foreground">Serial (from the airframe label)</label>
            <input id={ids.serial} required value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="AIR4-0626-0025" className={`${field} font-mono`} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.model} className="text-xs font-medium text-muted-foreground">Model</label>
            <select id={ids.model} required value={modelId} onChange={(e) => setModelId(e.target.value)} className={`${field} cursor-pointer`}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.client} className="text-xs font-medium text-muted-foreground">Client</label>
            <select id={ids.client} value={clientId} onChange={(e) => setClientId(e.target.value)} className={`${field} cursor-pointer`}>
              <option value="">No client yet (AIR6 stock)</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-start gap-2">
            <input
              id={ids.template}
              type="checkbox"
              checked={fromTemplate && !!model?.hasTemplate}
              disabled={!model?.hasTemplate}
              onChange={(e) => setFromTemplate(e.target.checked)}
              className="mt-0.5 cursor-pointer"
            />
            <label htmlFor={ids.template} className="text-xs text-foreground cursor-pointer">
              Start its history from the model template
              <span className="block text-muted-foreground">
                {model?.hasTemplate
                  ? `v1 will be a copy of ${model.name}'s template${isAdmin ? "" : ", waiting for review"}.`
                  : "This model has no template yet, so the history starts empty."}
              </span>
            </label>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap disabled:opacity-50">Cancel</button>
          <BusyButton type="submit" busy={busy} busyLabel="Adding…" disabled={!serial.trim() || !modelId} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            Add drone
          </BusyButton>
        </div>
      </form>
    </div>
  );
}
