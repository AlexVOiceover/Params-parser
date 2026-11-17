"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Box, Building2, ChevronDown, ChevronRight, Plus, Search, Usb, X } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { Dialog } from "@/components/ui/dialog";
import { buttonClass, cardClass, fieldClass, labelClass, pageLeadClass, pageTitleClass } from "@/components/ui/styles";
import { FleetStatusBadge, STATUS_META, statusName } from "@/components/status-badge";
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

type GroupBy = "none" | "model" | "client";
type SortKey = "serial" | "model" | "client" | "status" | "target" | "last";
interface Sort { key: SortKey; dir: "asc" | "desc" }
interface Column { key: SortKey; label: string; width: string }

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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort>({ key: "status", dir: "asc" });
  const searchId = useId();
  const clientFilterId = useId();
  const sortId = useId();

  // Remember the grouping per browser; it is a viewing preference.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("air6_drones_group");
      if (saved === "model" || (saved === "client" && isStaff)) setGroupByState(saved);
    } catch {}
  }, [isStaff]);
  function setGroupBy(g: GroupBy) {
    setGroupByState(g);
    setCollapsed(new Set());
    try { localStorage.setItem("air6_drones_group", g); } catch {}
  }
  function toggleSort(key: SortKey) {
    setSort((prev) => ({ key, dir: prev.key === key && prev.dir === "asc" ? "desc" : "asc" }));
  }
  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
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
    if (groupBy === "none") return null;
    const map = new Map<string, FleetRow[]>();
    for (const r of visible) {
      const key = groupBy === "model" ? r.modelName : r.clientName ?? "No client";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === "No client" ? 1 : b === "No client" ? -1 : a.localeCompare(b)))
      .map(([label, list]) => ({ label, rows: list }));
  }, [visible, groupBy]);

  // The grouped column is the group's title, so it is not repeated on every row.
  const columns: Column[] = [
    { key: "serial", label: "Serial", width: "minmax(11rem, 1.4fr)" },
    ...(groupBy !== "model" ? [{ key: "model" as const, label: "Model", width: "minmax(8rem, 1.1fr)" }] : []),
    ...(isStaff && groupBy !== "client" ? [{ key: "client" as const, label: "Client", width: "minmax(8rem, 1fr)" }] : []),
    { key: "status", label: "Status", width: "10.5rem" },
    { key: "target", label: "Target", width: "4rem" },
    { key: "last", label: "Last verified", width: "minmax(8rem, 0.9fr)" },
  ];
  const template = `${columns.map((c) => c.width).join(" ")} 1rem`;
  const nested = groups !== null;

  const attention = rows.filter((r) => r.status !== "up_to_date").length;
  const filtered = query.trim() !== "" || status !== "all" || clientId !== "all";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className={pageTitleClass}>{isStaff ? "Drones" : "Your drones"}</h1>
          <p className={pageLeadClass}>
            {rows.length} drone{rows.length === 1 ? "" : "s"}
            {attention > 0 && <> · <span className="font-medium text-foreground">{attention} need{attention === 1 ? "s" : ""} attention</span></>}
          </p>
        </div>
        {isStaff && (
          <button type="button" onClick={() => setAdding(true)} className={buttonClass("primary", "md")}>
            <Plus className="h-4 w-4" /> Add drone
          </button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
            <StatusChip active={status === "all"} onClick={() => setStatus("all")} label="All" count={rows.length} />
            {STATUS_ORDER.filter((s) => counts.has(s)).map((s) => (
              <StatusChip
                key={s}
                active={status === s}
                onClick={() => setStatus(status === s ? "all" : s)}
                dot={STATUS_META[s].dot}
                label={statusName(s, isStaff)}
                count={counts.get(s) ?? 0}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-56 flex-1">
              <label htmlFor={searchId} className="sr-only">Search drones</label>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id={searchId}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isStaff ? "Search serial, model or client…" : "Search serial or model…"}
                className={`${fieldClass} w-full pl-9 pr-7`}
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onMouseDown={(e) => { e.preventDefault(); setQuery(""); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span id={`${searchId}-group`} className="text-[13px] text-muted-foreground">Group by</span>
              <div role="radiogroup" aria-labelledby={`${searchId}-group`} className="flex h-9 items-center rounded-lg border border-border bg-secondary p-0.5">
                {([["none", "None"], ["model", "Model"], ...(isStaff ? [["client", "Client"]] : [])] as [GroupBy, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={groupBy === value}
                    onClick={() => setGroupBy(value)}
                    className={`h-full rounded-md px-3 text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      groupBy === value ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {isStaff && clients.length > 0 && (
              <>
                <label htmlFor={clientFilterId} className="sr-only">Client</label>
                <select id={clientFilterId} value={clientId} onChange={(e) => setClientId(e.target.value)} className={`${fieldClass} shrink-0 cursor-pointer`}>
                  <option value="all">All clients</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="none">No client</option>
                </select>
              </>
            )}

            {/* On phones the column headers are hidden, so sorting moves here. */}
            <div className="md:hidden">
              <label htmlFor={sortId} className="sr-only">Sort by</label>
              <select
                id={sortId}
                value={`${sort.key}:${sort.dir}`}
                onChange={(e) => { const [key, dir] = e.target.value.split(":") as [SortKey, Sort["dir"]]; setSort({ key, dir }); }}
                className={`${fieldClass} cursor-pointer`}
              >
                {columns.flatMap((c) => [
                  <option key={`${c.key}:asc`} value={`${c.key}:asc`}>Sort: {c.label} ↑</option>,
                  <option key={`${c.key}:desc`} value={`${c.key}:desc`}>Sort: {c.label} ↓</option>,
                ])}
              </select>
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className={`${cardClass} px-6 py-14 text-center`}>
          <p className="text-sm font-medium text-foreground">No drones yet</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {isStaff ? "Add one, or connect a new drone and register it." : "No drone is registered to your account yet. Contact AIR6 to set one up."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div
            className={`hidden items-center gap-4 pr-4 text-xs font-medium text-muted-foreground md:grid ${nested ? "pl-14" : "pl-4"}`}
            style={{ gridTemplateColumns: template }}
          >
            {columns.map((c) => <SortHeader key={c.key} column={c} sort={sort} onSort={toggleSort} />)}
            <span />
          </div>

          {visible.length === 0 ? (
            <div className={`${cardClass} flex flex-col items-center gap-3 px-6 py-10 text-center`}>
              <p className="text-sm text-muted-foreground">No drones match.</p>
              {filtered && (
                <button type="button" onClick={() => { setQuery(""); setStatus("all"); setClientId("all"); }} className={buttonClass("secondary")}>
                  Clear filters
                </button>
              )}
            </div>
          ) : groups ? (
            <div className="flex flex-col gap-3">
              {groups.map((g) => {
                const open = !collapsed.has(g.label);
                return (
                  <section key={g.label} className={`${cardClass} overflow-hidden`}>
                    <h2>
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => toggleGroup(g.label)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60 cursor-pointer"
                      >
                        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                          {groupBy === "client" ? <Building2 className="h-4 w-4" /> : <Box className="h-4 w-4" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">{g.label}</span>
                          <span className="block text-xs font-normal text-muted-foreground">{g.rows.length} drone{g.rows.length === 1 ? "" : "s"}</span>
                        </span>
                        <GroupSummary rows={g.rows} isStaff={isStaff} />
                      </button>
                    </h2>
                    {open && (
                      <ul className="relative border-t border-border before:absolute before:bottom-3 before:left-6 before:top-0 before:w-px before:bg-border">
                        {g.rows.map((r) => (
                          <li key={r.id} className="relative ml-14 border-b border-border last:border-b-0 before:absolute before:-left-8 before:top-1/2 before:h-px before:w-5 before:bg-border">
                            <DroneRow row={r} columns={columns} template={template} isStaff={isStaff} connected={connectedId === r.id} nested />
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                );
              })}
            </div>
          ) : (
            <ul className={`${cardClass} divide-y divide-border overflow-hidden`}>
              {visible.map((r) => (
                <li key={r.id}>
                  <DroneRow row={r} columns={columns} template={template} isStaff={isStaff} connected={connectedId === r.id} />
                </li>
              ))}
            </ul>
          )}
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

function SortHeader({ column, sort, onSort }: { column: Column; sort: Sort; onSort: (k: SortKey) => void }) {
  const active = sort.key === column.key;
  const Icon = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <span aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
      <button
        type="button"
        onClick={() => onSort(column.key)}
        title={`Sort by ${column.label.toLowerCase()}`}
        className={`-mx-1.5 flex h-7 items-center gap-1 rounded-md px-1.5 transition-colors cursor-pointer whitespace-nowrap hover:bg-secondary hover:text-foreground ${active ? "text-foreground" : ""}`}
      >
        {column.label}
        {active && <Icon className="h-3 w-3" />}
      </button>
    </span>
  );
}

function DroneRow({ row: r, columns, template, isStaff, connected, nested = false }: {
  row: FleetRow;
  columns: Column[];
  template: string;
  isStaff: boolean;
  connected: boolean;
  nested?: boolean;
}) {
  const has = (key: SortKey) => columns.some((c) => c.key === key);
  const last = r.lastLabel ? `v${r.lastLabel} · ${ago(r.lastAt)}` : null;
  return (
    <Link
      href={droneHref(r.serial)}
      className={`group flex flex-col gap-1 py-3 pr-4 transition-colors hover:bg-secondary/60 cursor-pointer md:grid md:items-center md:gap-4 md:py-2.5 ${nested ? "pl-0" : "pl-4"}`}
      style={{ gridTemplateColumns: template }}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="truncate font-mono text-sm font-semibold text-foreground group-hover:text-primary">{r.serial}</span>
        {connected && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-600/25 bg-emerald-500/10 px-1.5 py-px text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            <Usb className="h-2.5 w-2.5" /> connected
          </span>
        )}
        <span className="ml-auto shrink-0 md:hidden"><FleetStatusBadge row={r} isStaff={isStaff} /></span>
      </span>
      {has("model") && <span className="hidden truncate text-[13px] text-muted-foreground md:block">{r.modelName}</span>}
      {has("client") && (
        <span className="hidden truncate text-[13px] text-foreground md:block">
          {r.clientName ?? <span className="text-muted-foreground">No client</span>}
        </span>
      )}
      <span className="hidden md:block"><FleetStatusBadge row={r} isStaff={isStaff} /></span>
      <span className="hidden font-mono text-[13px] text-foreground md:block">{r.target ? `v${r.target}` : <span className="text-muted-foreground">—</span>}</span>
      <span className="hidden truncate text-[13px] text-muted-foreground md:block">{last ?? "—"}</span>
      <ChevronRight className="hidden h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 md:block" aria-hidden="true" />

      {/* Phones: everything else on a second line, so nothing is hidden. */}
      <span className="text-xs leading-snug text-muted-foreground md:hidden">
        {[
          has("model") ? r.modelName : null,
          has("client") ? r.clientName ?? "No client" : null,
          r.target ? `target v${r.target}` : null,
          last ? `verified ${last}` : null,
        ].filter(Boolean).join(" · ")}
      </span>
    </Link>
  );
}

/** What is inside a group, so a collapsed group still says whether it needs attention. */
function GroupSummary({ rows, isStaff }: { rows: FleetRow[]; isStaff: boolean }) {
  const present = STATUS_ORDER.map((s) => ({ s, n: rows.filter((r) => r.status === s).length })).filter((x) => x.n > 0);
  return (
    <span className="ml-auto flex shrink-0 items-center gap-x-3 gap-y-1 text-xs font-normal text-muted-foreground">
      {present.map(({ s, n }) => (
        <span key={s} className="flex items-center gap-1.5 whitespace-nowrap" title={`${n} ${statusName(s, isStaff).toLowerCase()}`}>
          <span className={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} aria-hidden="true" />
          {n}<span className="hidden lg:inline"> {statusName(s, isStaff).toLowerCase()}</span>
        </span>
      ))}
    </span>
  );
}

function StatusChip({ active, onClick, dot, label, count }: { active: boolean; onClick: () => void; dot?: string; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-8 items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground shadow-xs hover:bg-secondary"
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />}
      {label}
      <span className={`tabular-nums ${active ? "text-primary" : "text-muted-foreground"}`}>{count}</span>
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

  return (
    <Dialog
      title="Add drone"
      onClose={onClose}
      busy={busy}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass("secondary")}>Cancel</button>
          <BusyButton type="submit" variant="primary" busy={busy} busyLabel="Adding…" disabled={!serial.trim() || !modelId}>
            Add drone
          </BusyButton>
        </>
      }
    >
      <p className="rounded-lg bg-secondary px-3 py-2 text-[13px] text-muted-foreground">
        To add the drone that is plugged in, connect it instead: the app reads it and links its flight controller in one go.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.serial} className={labelClass}>Serial <span className="font-normal text-muted-foreground">(from the airframe label)</span></label>
        <input id={ids.serial} required value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="AIR4-0626-0025" className={`${fieldClass} font-mono`} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.model} className={labelClass}>Model</label>
        <select id={ids.model} required value={modelId} onChange={(e) => setModelId(e.target.value)} className={`${fieldClass} cursor-pointer`}>
          {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.client} className={labelClass}>Client</label>
        <select id={ids.client} value={clientId} onChange={(e) => setClientId(e.target.value)} className={`${fieldClass} cursor-pointer`}>
          <option value="">No client yet (AIR6 stock)</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="flex items-start gap-2.5">
        <input
          id={ids.template}
          type="checkbox"
          checked={fromTemplate && !!model?.hasTemplate}
          disabled={!model?.hasTemplate}
          onChange={(e) => setFromTemplate(e.target.checked)}
          className="mt-0.5"
        />
        <label htmlFor={ids.template} className="text-[13px] text-foreground cursor-pointer">
          Start its history from the model template
          <span className="block text-muted-foreground">
            {model?.hasTemplate
              ? `v1 will be a copy of ${model.name}'s template${isAdmin ? "" : ", waiting for review"}.`
              : "This model has no template yet, so the history starts empty."}
          </span>
        </label>
      </div>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </Dialog>
  );
}
