"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { ChipLinkCell } from "@/components/chip-link-cell";
import { WriteNFCButton } from "@/components/write-nfc-button";
import { droneHref } from "@/lib/versions";

interface Option { id: string; name: string }

interface Props {
  droneId: string;
  serial: string;
  chipId: string | null;
  clientId: string | null;
  variantId: string;
  clients: Option[];
  models: Option[];
  isAdmin: boolean;
}

/** Staff-only settings at the bottom of a drone's page. */
export function DroneSettings({ droneId, serial, chipId, clientId, variantId, clients, models, isAdmin }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [serialInput, setSerialInput] = useState(serial);
  const [client, setClient] = useState(clientId ?? "");
  const [model, setModel] = useState(variantId);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ids = { serial: useId(), client: useId(), model: useId() };

  const changed = serialInput.trim() !== serial || client !== (clientId ?? "") || model !== variantId;

  async function save() {
    setBusy("save");
    setError(null);
    const body: { serial?: string; clientId?: string | null; variantId?: string } = {};
    if (serialInput.trim() !== serial) body.serial = serialInput.trim();
    if (client !== (clientId ?? "")) body.clientId = client || null;
    if (model !== variantId) body.variantId = model;
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

  const field = "rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring disabled:opacity-60";

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Drone settings</h2>
      <div className="rounded-lg border border-border bg-card px-4 py-4 flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.serial} className="text-xs font-medium text-muted-foreground">Serial</label>
            <input id={ids.serial} value={serialInput} onChange={(e) => setSerialInput(e.target.value)} className={`${field} font-mono`} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.client} className="text-xs font-medium text-muted-foreground">Client</label>
            <select id={ids.client} value={client} onChange={(e) => setClient(e.target.value)} disabled={!isAdmin} className={`${field} cursor-pointer`}>
              <option value="">No client (AIR6 stock)</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.model} className="text-xs font-medium text-muted-foreground">Model</label>
            <select id={ids.model} value={model} onChange={(e) => setModel(e.target.value)} disabled={!isAdmin} className={`${field} cursor-pointer`}>
              {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        {model !== variantId && (
          <p className="text-xs text-amber-700 dark:text-amber-300">The drone keeps its history; only its model label changes.</p>
        )}
        {changed && (
          <div>
            <BusyButton type="button" busy={busy === "save"} busyLabel="Saving…" onClick={save} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              Save changes
            </BusyButton>
          </div>
        )}

        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
          <span className="text-xs font-medium text-muted-foreground">Flight controller</span>
          <div className="text-xs"><ChipLinkCell droneId={droneId} serial={serial} chipId={chipId} /></div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
          <span className="text-xs font-medium text-muted-foreground">NFC sticker</span>
          <div className="flex items-center gap-2 flex-wrap">
            <WriteNFCButton serial={serial} label="Write NFC tag" />
            <span className="text-[11px] text-muted-foreground">Tapping the sticker with a phone opens this page.</span>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 border-t border-border pt-4 flex-wrap">
            {confirmDelete ? (
              <>
                <span className="text-xs text-foreground">Delete {serial} and its whole history? This cannot be undone.</span>
                <BusyButton type="button" busy={busy === "delete"} busyLabel="Deleting…" onClick={remove} className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white hover:bg-destructive/90">
                  Delete drone
                </BusyButton>
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap">Keep it</button>
              </>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 cursor-pointer whitespace-nowrap">
                <Trash2 className="h-3.5 w-3.5" /> Delete drone
              </button>
            )}
          </div>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </section>
  );
}
