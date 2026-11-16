"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { modelHref } from "@/lib/versions";

export interface ModelRow {
  id: string;
  name: string;
  template: string | null;
  pending: string | null;
  drones: number;
}

export interface FamilyGroup {
  id: string;
  name: string;
  models: ModelRow[];
}

export function ModelList({ families, isAdmin }: { families: FamilyGroup[]; isAdmin: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function deleteFamily(id: string) {
    setDeleting(id);
    setError(null);
    const res = await fetch(`/api/admin/families/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({})) as { error?: string };
      setError(b.error ?? "Could not delete");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Models</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Each model has a template: the reference params a new drone of that model starts from.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" /> Add model
          </button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2 text-left font-semibold">Model</th>
              <th className="px-4 py-2 text-left font-semibold">Template</th>
              <th className="px-4 py-2 text-left font-semibold">Drones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {families.map((f) => (
              <FamilyRows key={f.id} family={f} isAdmin={isAdmin} deleting={deleting === f.id} onDelete={() => deleteFamily(f.id)} />
            ))}
            {families.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-xs text-muted-foreground">No models yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {adding && <AddModelDialog families={families} onClose={() => setAdding(false)} onAdded={() => { setAdding(false); startTransition(() => router.refresh()); }} />}
    </div>
  );
}

function FamilyRows({ family, isAdmin, deleting, onDelete }: { family: FamilyGroup; isAdmin: boolean; deleting: boolean; onDelete: () => void }) {
  const router = useRouter();
  if (family.models.length === 0) {
    return (
      <tr>
        <td className="px-4 py-2.5 text-foreground">{family.name}</td>
        <td className="px-4 py-2.5 text-xs text-muted-foreground" colSpan={isAdmin ? 1 : 2}>No variants</td>
        {isAdmin && (
          <td className="px-4 py-2.5 text-right">
            <BusyButton type="button" busy={deleting} aria-label={`Delete ${family.name}`} onClick={onDelete} icon={<Trash2 className="h-3.5 w-3.5" />} className="rounded p-1 text-muted-foreground hover:text-destructive" />
          </td>
        )}
      </tr>
    );
  }
  return (
    <>
      {family.models.map((m) => (
        <tr key={m.id} onClick={() => router.push(modelHref(m.id))} className="cursor-pointer hover:bg-secondary/40 transition-colors">
          <td className="px-4 py-2.5">
            <Link href={modelHref(m.id)} onClick={(e) => e.stopPropagation()} className="font-medium text-foreground hover:text-primary cursor-pointer whitespace-nowrap">
              {m.name}
            </Link>
          </td>
          <td className="px-4 py-2.5 text-xs">
            {m.template ? <span className="font-mono">v{m.template}</span> : <span className="text-muted-foreground">No template yet</span>}
            {m.pending && <span className="ml-2 text-sky-700 dark:text-sky-300">v{m.pending} to review</span>}
          </td>
          <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.drones}</td>
        </tr>
      ))}
    </>
  );
}

function AddModelDialog({ families, onClose, onAdded }: { families: FamilyGroup[]; onClose: () => void; onAdded: () => void }) {
  const [familyId, setFamilyId] = useState(families[0]?.id ?? "__new__");
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
          <h2 className="text-sm font-semibold text-foreground">Add model</h2>
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
            Add model
          </BusyButton>
        </div>
      </form>
    </div>
  );
}
