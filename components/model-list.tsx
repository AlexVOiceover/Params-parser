"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { modelHref } from "@/lib/versions";

export interface ModelRow {
  id: string;
  name: string;
  description: string | null;
  template: string | null;
  pending: string | null;
  drones: number;
}

export interface FamilyGroup {
  id: string;
  name: string;
  description: string | null;
  models: ModelRow[];
}

export function ModelList({ families, isAdmin }: { families: FamilyGroup[]; isAdmin: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState<string | null>(null);
  const refresh = () => startTransition(() => router.refresh());

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Models</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Product lines and their variants. Each variant has a template: the reference params a new drone of that model starts from.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAdding("__new__")}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" /> Add product line
          </button>
        )}
      </div>

      {families.length === 0 && (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">No models yet.</div>
      )}

      {families.map((f) => (
        <FamilyCard key={f.id} family={f} isAdmin={isAdmin} onAddVariant={() => setAdding(f.id)} onChanged={refresh} />
      ))}

      {adding && (
        <AddModelDialog
          families={families}
          initialFamilyId={adding}
          onClose={() => setAdding(null)}
          onAdded={() => { setAdding(null); refresh(); }}
        />
      )}
    </div>
  );
}

function FamilyCard({ family, isAdmin, onAddVariant, onChanged }: {
  family: FamilyGroup;
  isAdmin: boolean;
  onAddVariant: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(family.name);
  const [description, setDescription] = useState(family.description ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ids = { name: useId(), description: useId() };
  const drones = family.models.reduce((n, m) => n + m.drones, 0);

  async function call(method: "PATCH" | "DELETE") {
    setBusy(method === "PATCH" ? "save" : "delete");
    setError(null);
    const res = await fetch(`/api/admin/families/${family.id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "PATCH" ? JSON.stringify({ name: name.trim(), description }) : undefined,
    });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({})) as { error?: string };
      setError(b.error ?? "That did not work");
      setConfirmDelete(false);
      return;
    }
    setEditing(false);
    onChanged();
  }

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <header className="flex items-start gap-3 flex-wrap border-b border-border bg-secondary px-4 py-2.5">
        {editing ? (
          <form onSubmit={(e) => { e.preventDefault(); call("PATCH"); }} className="flex items-end gap-2 flex-wrap">
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.name} className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Product line</label>
              <input id={ids.name} value={name} onChange={(e) => setName(e.target.value)} className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.description} className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Description</label>
              <input id={ids.description} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="w-72 rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <BusyButton type="submit" busy={busy === "save"} busyLabel="Saving…" disabled={!name.trim()} className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">Save</BusyButton>
            <button type="button" onClick={() => { setEditing(false); setName(family.name); setDescription(family.description ?? ""); }} className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-card cursor-pointer whitespace-nowrap">Cancel</button>
          </form>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-sm font-semibold text-foreground">{family.name}</h2>
              <span className="text-xs text-muted-foreground">
                {family.models.length} variant{family.models.length === 1 ? "" : "s"} · {drones} drone{drones === 1 ? "" : "s"}
              </span>
            </div>
            {family.description && <p className="text-xs text-muted-foreground mt-0.5">{family.description}</p>}
          </div>
        )}
        {isAdmin && !editing && (
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={onAddVariant} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-card cursor-pointer whitespace-nowrap">
              <Plus className="h-3.5 w-3.5" /> Add variant
            </button>
            <button type="button" aria-label={`Edit ${family.name}`} title="Edit name and description" onClick={() => setEditing(true)} className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-card cursor-pointer">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {confirmDelete ? (
              <span className="flex items-center gap-1">
                <BusyButton type="button" busy={busy === "delete"} busyLabel="Deleting…" onClick={() => call("DELETE")} className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-white hover:bg-destructive/90">Delete {family.name}</BusyButton>
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-card cursor-pointer whitespace-nowrap">Keep</button>
              </span>
            ) : (
              <button
                type="button"
                aria-label={`Delete ${family.name}`}
                title={family.models.length > 0 ? "Delete its variants first" : `Delete ${family.name}`}
                disabled={family.models.length > 0}
                onClick={() => setConfirmDelete(true)}
                className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-card cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </header>
      {error && <p className="px-4 pt-2 text-xs text-destructive">{error}</p>}

      {family.models.length === 0 ? (
        <p className="px-4 py-3 text-xs text-muted-foreground">No variants yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-1.5 text-left font-semibold">Variant</th>
              <th className="px-4 py-1.5 text-left font-semibold">Template</th>
              <th className="px-4 py-1.5 text-left font-semibold w-20">Drones</th>
              {isAdmin && <th className="px-4 py-1.5 w-28"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {family.models.map((m) => <VariantRow key={m.id} m={m} isAdmin={isAdmin} onChanged={onChanged} />)}
          </tbody>
        </table>
      )}
    </section>
  );
}

function VariantRow({ m, isAdmin, onChanged }: { m: ModelRow; isAdmin: boolean; onChanged: () => void }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(m.name);
  const [description, setDescription] = useState(m.description ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ids = { name: useId(), description: useId() };

  async function call(method: "PATCH" | "DELETE") {
    setBusy(method === "PATCH" ? "save" : "delete");
    setError(null);
    const res = await fetch(`/api/admin/variants/${m.id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "PATCH" ? JSON.stringify({ name: name.trim(), description }) : undefined,
    });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({})) as { error?: string };
      setError(b.error ?? "That did not work");
      setConfirmDelete(false);
      return;
    }
    setEditing(false);
    onChanged();
  }

  if (editing) {
    return (
      <tr>
        <td colSpan={4} className="px-4 py-2.5">
          <form onSubmit={(e) => { e.preventDefault(); call("PATCH"); }} className="flex items-end gap-2 flex-wrap">
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.name} className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Variant</label>
              <input id={ids.name} value={name} onChange={(e) => setName(e.target.value)} className="rounded-md border border-border bg-secondary px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.description} className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Description</label>
              <input id={ids.description} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="w-72 rounded-md border border-border bg-secondary px-2 py-1 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" />
            </div>
            <BusyButton type="submit" busy={busy === "save"} busyLabel="Saving…" disabled={!name.trim()} className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90">Save</BusyButton>
            <button type="button" onClick={() => { setEditing(false); setName(m.name); setDescription(m.description ?? ""); }} className="rounded-md border border-border px-2.5 py-1 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap">Cancel</button>
            {error && <span className="text-xs text-destructive">{error}</span>}
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr onClick={() => router.push(modelHref(m.id))} className="cursor-pointer hover:bg-secondary/40 transition-colors">
      <td className="px-4 py-2.5">
        <Link href={modelHref(m.id)} onClick={(e) => e.stopPropagation()} className="font-medium text-foreground hover:text-primary cursor-pointer whitespace-nowrap">
          {m.name}
        </Link>
        {m.description && <p className="font-sans text-[11px] text-muted-foreground leading-snug">{m.description}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </td>
      <td className="px-4 py-2.5 text-xs">
        {m.template ? <span className="font-mono">v{m.template}</span> : <span className="text-muted-foreground">No template yet</span>}
        {m.pending && <span className="ml-2 text-sky-700 dark:text-sky-300">v{m.pending} to review</span>}
      </td>
      <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.drones}</td>
      {isAdmin && (
        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {confirmDelete ? (
              <>
                <BusyButton type="button" busy={busy === "delete"} busyLabel="Deleting…" onClick={() => call("DELETE")} className="rounded-md bg-destructive px-2 py-1 text-xs font-medium text-white hover:bg-destructive/90">Delete</BusyButton>
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md border border-border px-2 py-1 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap">Keep</button>
              </>
            ) : (
              <>
                <button type="button" aria-label={`Edit ${m.name}`} title="Edit name and description" onClick={() => setEditing(true)} className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${m.name}`}
                  title={m.drones > 0 ? `${m.drones} drone${m.drones === 1 ? " uses" : "s use"} it — move or delete them first` : "Delete this variant and its template history"}
                  disabled={m.drones > 0}
                  onClick={() => setConfirmDelete(true)}
                  className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-secondary cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}

function AddModelDialog({ families, initialFamilyId, onClose, onAdded }: {
  families: FamilyGroup[];
  initialFamilyId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [familyId, setFamilyId] = useState(initialFamilyId);
  const [familyName, setFamilyName] = useState("");
  const [variant, setVariant] = useState("Base");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { family: useId(), familyName: useId(), variant: useId() };
  const isNew = familyId === "__new__";

  async function post(url: string, body: object): Promise<{ id?: string } | null> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const b = await res.json().catch(() => ({})) as { error?: string; id?: string };
    if (!res.ok) { setError(b.error ?? "Could not add the model"); return null; }
    return { id: b.id };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    let ok = true;
    if (isNew) {
      // A new model line comes with a "Base" variant.
      const fam = await post("/api/admin/families", { name: familyName.trim() });
      ok = !!fam;
      if (fam?.id && variant.trim() && variant.trim() !== "Base") ok = !!(await post("/api/admin/variants", { familyId: fam.id, name: variant.trim() }));
    } else {
      ok = !!(await post("/api/admin/variants", { familyId, name: variant.trim() }));
    }
    setBusy(false);
    if (ok) onAdded();
  }

  const field = "rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <form onSubmit={submit} className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">{isNew ? "Add product line" : "Add variant"}</h2>
          <button type="button" aria-label="Close" onClick={onClose} disabled={busy} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.family} className="text-xs font-medium text-muted-foreground">Product line</label>
            <select id={ids.family} value={familyId} onChange={(e) => setFamilyId(e.target.value)} className={`${field} cursor-pointer`}>
              {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              <option value="__new__">New product line…</option>
            </select>
          </div>
          {isNew && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.familyName} className="text-xs font-medium text-muted-foreground">Product line name</label>
              <input id={ids.familyName} required value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="AIR8" className={field} />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.variant} className="text-xs font-medium text-muted-foreground">Variant</label>
            <input id={ids.variant} required value={variant} onChange={(e) => setVariant(e.target.value)} placeholder="Base" className={field} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap disabled:opacity-50">Cancel</button>
          <BusyButton type="submit" busy={busy} busyLabel="Adding…" disabled={!variant.trim() || (isNew && !familyName.trim())} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            {isNew ? "Add product line" : "Add variant"}
          </BusyButton>
        </div>
      </form>
    </div>
  );
}
