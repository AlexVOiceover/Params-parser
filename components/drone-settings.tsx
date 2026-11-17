"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { buttonClass, cardClass, fieldClass, labelClass, sectionTitleClass } from "@/components/ui/styles";
import { ChipLinkCell } from "@/components/chip-link-cell";
import { WriteNFCButton } from "@/components/write-nfc-button";
import { droneHref } from "@/lib/versions";

interface Option { id: string; name: string }

interface Props {
  droneId: string;
  setId: string | null;
  description: string | null;
  serial: string;
  chipId: string | null;
  clientId: string | null;
  variantId: string;
  clients: Option[];
  models: Option[];
  isAdmin: boolean;
}

/** Staff-only settings at the bottom of a drone's page. */
export function DroneSettings({ droneId, setId, description, serial, chipId, clientId, variantId, clients, models, isAdmin }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [serialInput, setSerialInput] = useState(serial);
  const [client, setClient] = useState(clientId ?? "");
  const [model, setModel] = useState(variantId);
  const [desc, setDesc] = useState(description ?? "");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ids = { serial: useId(), client: useId(), model: useId(), description: useId() };

  const descChanged = desc !== (description ?? "");
  const changed = serialInput.trim() !== serial || client !== (clientId ?? "") || model !== variantId || descChanged;

  async function save() {
    setBusy("save");
    setError(null);
    const body: { serial?: string; clientId?: string | null; variantId?: string } = {};
    if (serialInput.trim() !== serial) body.serial = serialInput.trim();
    if (client !== (clientId ?? "")) body.clientId = client || null;
    if (model !== variantId) body.variantId = model;
    if (descChanged && setId) {
      const r = await fetch(`/api/admin/client-sets/${setId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: desc }),
      });
      if (!r.ok) {
        setBusy(null);
        const b = await r.json().catch(() => ({})) as { error?: string };
        setError(b.error ?? "Could not save the description");
        return;
      }
      if (Object.keys(body).length === 0) { setBusy(null); startTransition(() => router.refresh()); return; }
    }
    const res = await fetch(`/api/admin/drones/${droneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({})) as { error?: string };
      setError(b.error ?? "Could not save");
      return;
    }
    if (body.serial) router.replace(droneHref(body.serial));
    else startTransition(() => router.refresh());
  }

  async function remove() {
    setBusy("delete");
    setError(null);
    const res = await fetch(`/api/admin/drones/${droneId}`, { method: "DELETE" });
    if (!res.ok) {
      setBusy(null);
      const b = await res.json().catch(() => ({})) as { error?: string };
      setError(b.error ?? "Could not delete");
      return;
    }
    router.push("/");
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className={sectionTitleClass}>Drone settings</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Only AIR6 staff see this section.</p>
      </div>
      <div className={`${cardClass} divide-y divide-border`}>
        <div className="flex flex-col gap-4 px-5 py-5">
          <h3 className="text-sm font-semibold text-foreground">Details</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.serial} className={labelClass}>Serial</label>
              <input id={ids.serial} value={serialInput} onChange={(e) => setSerialInput(e.target.value)} className={`${fieldClass} w-full font-mono`} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.client} className={labelClass}>Client</label>
              <select id={ids.client} value={client} onChange={(e) => setClient(e.target.value)} disabled={!isAdmin} className={`${fieldClass} w-full cursor-pointer`}>
                <option value="">No client (AIR6 stock)</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.model} className={labelClass}>Model</label>
              <select id={ids.model} value={model} onChange={(e) => setModel(e.target.value)} disabled={!isAdmin} className={`${fieldClass} w-full cursor-pointer`}>
                {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          {!isAdmin && <p className="text-xs text-muted-foreground">Only an admin can change the client or the model.</p>}
          {setId && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.description} className={labelClass}>Description</label>
              <input id={ids.description} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Optional, e.g. payload or special setup" className={`${fieldClass} w-full`} />
            </div>
          )}
          {model !== variantId && (
            <p className="text-[13px] text-amber-700 dark:text-amber-300">The drone keeps its history; only its model label changes.</p>
          )}
          {changed && (
            <div>
              <BusyButton type="button" variant="primary" busy={busy === "save"} busyLabel="Saving…" onClick={save}>
                Save changes
              </BusyButton>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 px-5 py-5">
          <h3 className="text-sm font-semibold text-foreground">Flight controller</h3>
          <p className="text-[13px] text-muted-foreground">Its chip ID is how the app recognises this drone when it is plugged in.</p>
          <div className="text-[13px]"><ChipLinkCell droneId={droneId} serial={serial} chipId={chipId} /></div>
        </div>

        <div className="flex flex-col gap-2 px-5 py-5">
          <h3 className="text-sm font-semibold text-foreground">NFC sticker</h3>
          <p className="text-[13px] text-muted-foreground">Tapping the sticker with a phone opens this page.</p>
          <div><WriteNFCButton serial={serial} label="Write NFC tag" /></div>
        </div>

        {isAdmin && (
          <div className="flex flex-col gap-2 px-5 py-5">
            <h3 className="text-sm font-semibold text-foreground">Delete this drone</h3>
            <p className="text-[13px] text-muted-foreground">Removes {serial}, every version in its history and its log. This cannot be undone.</p>
            <div className="flex flex-wrap items-center gap-2">
              {confirmDelete ? (
                <>
                  <span className="text-[13px] font-medium text-foreground">Delete {serial} and its whole history? This cannot be undone.</span>
                  <BusyButton type="button" variant="danger" busy={busy === "delete"} busyLabel="Deleting…" onClick={remove}>
                    Delete drone
                  </BusyButton>
                  <button type="button" onClick={() => setConfirmDelete(false)} className={buttonClass("secondary")}>Keep it</button>
                </>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className={buttonClass("dangerOutline")}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete drone
                </button>
              )}
            </div>
          </div>
        )}
        {error && <p role="alert" className="px-5 py-3 text-[13px] text-destructive">{error}</p>}
      </div>
    </section>
  );
}
