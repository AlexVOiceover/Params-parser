"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";

/** Admin: rename or delete a model (variant). Deleting is refused while drones use it. */
export function ModelSettings({ variantId, name, droneCount }: { variantId: string; name: string; droneCount: number }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function call(method: "PATCH" | "DELETE") {
    setBusy(method === "PATCH" ? "save" : "delete");
    setError(null);
    const res = await fetch(`/api/admin/variants/${variantId}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "PATCH" ? JSON.stringify({ name: value.trim() }) : undefined,
    });
    setBusy(null);
    if (!res.ok) {
      const b = await res.json().catch(() => ({})) as { error?: string };
      setError(b.error ?? "That did not work");
      setConfirm(false);
      return;
    }
    if (method === "DELETE") router.push("/models");
    else startTransition(() => router.refresh());
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Model settings</h2>
      <div className="rounded-lg border border-border bg-card px-4 py-4 flex flex-col gap-4">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={id} className="text-xs font-medium text-muted-foreground">Variant name</label>
            <input id={id} value={value} onChange={(e) => setValue(e.target.value)} className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring" />
          </div>
          {value.trim() && value.trim() !== name && (
            <BusyButton type="button" busy={busy === "save"} busyLabel="Saving…" onClick={() => call("PATCH")} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
              Rename
            </BusyButton>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border pt-4 flex-wrap">
          {droneCount > 0 ? (
            <p className="text-xs text-muted-foreground">{droneCount} drone{droneCount === 1 ? " uses" : "s use"} this model, so it cannot be deleted.</p>
          ) : confirm ? (
            <>
              <span className="text-xs text-foreground">Delete this model and its template history?</span>
              <BusyButton type="button" busy={busy === "delete"} busyLabel="Deleting…" onClick={() => call("DELETE")} className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white hover:bg-destructive/90">
                Delete model
              </BusyButton>
              <button type="button" onClick={() => setConfirm(false)} className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-secondary cursor-pointer whitespace-nowrap">Keep it</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs text-destructive hover:bg-destructive/10 cursor-pointer whitespace-nowrap">
              <Trash2 className="h-3.5 w-3.5" /> Delete model
            </button>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </section>
  );
}
