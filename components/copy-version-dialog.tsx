"use client";

import { useEffect, useId, useState } from "react";
import { X } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { createClient } from "@/lib/supabase/client";

interface Option { value: string; label: string }

/** Copy a version into another drone's history or a model's template. Staff only. */
export function CopyVersionDialog({ versionId, label, isAdmin, onClose, onCopied }: {
  versionId: string;
  label: string;
  isAdmin: boolean;
  onClose: () => void;
  onCopied: (message: string) => void;
}) {
  const [drones, setDrones] = useState<Option[]>([]);
  const [models, setModels] = useState<Option[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [target, setTarget] = useState("");
  const [changelog, setChangelog] = useState(`Copied from v${label}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { target: useId(), changelog: useId() };

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    Promise.all([
      supabase.from("drones").select("id, serial, client_id").order("serial"),
      supabase.from("clients").select("id, name"),
      supabase.from("variants").select("id, name, family_id"),
      supabase.from("families").select("id, name"),
    ]).then(([d, c, v, f]) => {
      const clientName = new Map((c.data ?? []).map((x) => [x.id, x.name]));
      const familyName = new Map((f.data ?? []).map((x) => [x.id, x.name]));
      setDrones((d.data ?? []).map((x) => ({ value: `drone:${x.id}`, label: `${x.serial}${x.client_id ? ` — ${clientName.get(x.client_id) ?? ""}` : ""}` })));
      setModels((v.data ?? [])
        .map((x) => ({ value: `model:${x.id}`, label: `${x.family_id ? familyName.get(x.family_id) ?? "" : ""} · ${x.name} template` }))
        .sort((a, b) => a.label.localeCompare(b.label)));
      setLoaded(true);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const [kind, id] = target.split(":");
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/versions/${versionId}/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kind === "drone" ? { droneId: id, changelog } : { variantId: id, changelog }),
    });
    const body = await res.json().catch(() => ({})) as { label?: string; approved?: boolean; error?: string };
    setBusy(false);
    if (!res.ok) { setError(body.error ?? "Could not copy"); return; }
    const name = [...drones, ...models].find((o) => o.value === target)?.label ?? "the target";
    onCopied(`Copied as v${body.label} of ${name}${body.approved ? "" : ", waiting for review"}.`);
  }

  const field = "rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <form onSubmit={submit} className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">Copy v{label} to…</h2>
          <button type="button" aria-label="Close" onClick={onClose} disabled={busy} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.target} className="text-xs font-medium text-muted-foreground">Copy into</label>
            <select id={ids.target} required value={target} onChange={(e) => setTarget(e.target.value)} disabled={!loaded} className={`${field} cursor-pointer`}>
              <option value="">{loaded ? "Choose a drone or a model template…" : "Loading…"}</option>
              <optgroup label="Drones">
                {drones.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
              <optgroup label="Model templates">
                {models.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.changelog} className="text-xs font-medium text-muted-foreground">Why? *</label>
            <input id={ids.changelog} required value={changelog} onChange={(e) => setChangelog(e.target.value)} className={field} />
          </div>
          <p className="text-xs text-muted-foreground">
            It is saved as the next version there{isAdmin ? " and becomes its target" : " and waits for review"}. Nothing here changes.
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap disabled:opacity-50">Cancel</button>
          <BusyButton type="submit" busy={busy} busyLabel="Copying…" disabled={!target || !changelog.trim()} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
            Copy
          </BusyButton>
        </div>
      </form>
    </div>
  );
}
