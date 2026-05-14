"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export function DeleteDroneButton({ droneId, serial }: { droneId: string; serial: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/admin/drones/${droneId}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setConfirming(false);
      startTransition(() => router.refresh());
    } else {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setError(body.error ?? "Delete failed");
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center justify-end gap-1.5">
        {error && <span className="text-[10px] text-destructive mr-1">{error}</span>}
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">Delete <span className="font-mono">{serial}</span>?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="rounded-md bg-destructive px-2 py-1 text-[11px] font-medium text-white hover:bg-destructive/90 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
        >
          {deleting ? "Deleting…" : "Delete"}
        </button>
        <button
          onClick={() => { setConfirming(false); setError(null); }}
          disabled={deleting}
          className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={`Delete drone ${serial}`}
      className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors cursor-pointer opacity-0 group-hover/row:opacity-100"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
