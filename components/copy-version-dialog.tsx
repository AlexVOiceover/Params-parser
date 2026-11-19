"use client";

import { useEffect, useId, useState } from "react";
import { BusyButton } from "@/components/ui/busy";
import { Dialog } from "@/components/ui/dialog";
import { buttonClass, fieldClass, labelClass } from "@/components/ui/styles";
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

  return (
    <Dialog
      title={`Copy v${label} to…`}
      onClose={onClose}
      busy={busy}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass("secondary")}>Cancel</button>
          <BusyButton type="submit" variant="primary" busy={busy} busyLabel="Copying…" disabled={!target || !changelog.trim()}>
            Copy
          </BusyButton>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.target} className={labelClass}>Copy into</label>
        <select id={ids.target} required value={target} onChange={(e) => setTarget(e.target.value)} disabled={!loaded} className={`${fieldClass} w-full cursor-pointer`}>
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
        <label htmlFor={ids.changelog} className={labelClass}>Why? <span className="text-destructive">*</span></label>
        <input id={ids.changelog} required value={changelog} onChange={(e) => setChangelog(e.target.value)} className={`${fieldClass} w-full`} />
      </div>
      <p className="text-[13px] text-muted-foreground">
        It is saved as the next version there{isAdmin ? " and becomes its target" : " and waits for review"}. Nothing here changes.
      </p>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </Dialog>
  );
}
