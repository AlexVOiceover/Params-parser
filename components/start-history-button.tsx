"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BusyButton } from "@/components/ui/busy";

/** For a drone registered before every drone got its own history. */
export function StartHistoryButton({ droneId, serial, variantId, clientId, clientName }: {
  droneId: string;
  serial: string;
  variantId: string;
  clientId: string | null;
  clientName: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/client-sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantId, clientId, droneId, clientName: clientName ?? serial, serial }),
    });
    setBusy(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({})) as { error?: string };
      setError(b.error ?? "Could not start the history");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-5 py-6 flex flex-col items-start gap-2">
      <p className="text-sm text-foreground">{serial} has no history of its own yet.</p>
      <p className="text-xs text-muted-foreground">Until it has one, it follows its model template.</p>
      <BusyButton type="button" busy={busy} busyLabel="Starting…" onClick={start} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
        Start its history
      </BusyButton>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
