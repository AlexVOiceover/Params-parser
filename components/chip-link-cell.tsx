"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, Unlink, X } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { parseChipIdInput } from "@/lib/chip-id";

/**
 * Fleet table cell for a drone's flight-controller link. Staff can paste the
 * chip ID or the Mission Planner Messages line ("CubeOrangePlus 00320021 …")
 * to link a drone remotely, re-link after an FC swap, or unlink a wrong link.
 */
export function ChipLinkCell({ droneId, serial, chipId }: { droneId: string; serial: string; chipId: string | null }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<"link" | "unlink" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseChipIdInput(input);

  async function link() {
    if (!parsed) return;
    setBusy("link");
    setError(null);
    const res = await fetch(`/api/admin/drones/${droneId}/link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chipId: input, method: /\s/.test(input.trim()) ? "messages_line" : "connect" }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setError(body.error ?? "Could not link");
      return;
    }
    setEditing(false);
    setInput("");
    startTransition(() => router.refresh());
  }

  async function unlink() {
    if (!window.confirm(`Unlink the flight controller from ${serial}? Its status and updates stop until it is linked again.`)) return;
    setBusy("unlink");
    setError(null);
    const res = await fetch(`/api/admin/drones/${droneId}/link`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      setError(body.error ?? "Could not unlink");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (editing) {
    const inputId = `chip-${droneId}`;
    return (
      <div className="flex flex-col gap-1 min-w-56">
        <label htmlFor={inputId} className="sr-only">Chip ID or Mission Planner Messages line for {serial}</label>
        <div className="relative">
          <input
            id={inputId}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Chip ID or Messages line"
            className="w-full rounded-md border border-border bg-background px-2 py-1 pr-7 text-xs font-mono"
          />
          {input && (
            <button
              type="button"
              aria-label="Clear"
              onMouseDown={(e) => { e.preventDefault(); setInput(""); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {input && (
          <span className={`text-[11px] font-mono ${parsed ? "text-muted-foreground" : "text-rose-700 dark:text-rose-300"}`}>
            {parsed ?? "Not a chip ID or Messages line"}
          </span>
        )}
        <div className="flex items-center gap-1.5">
          <BusyButton
            type="button"
            busy={busy === "link"}
            busyLabel="Linking…"
            onClick={link}
            disabled={!parsed}
            className="rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
          >
            {chipId ? "Re-link" : "Link"}
          </BusyButton>
          <button
            type="button"
            onClick={() => { setEditing(false); setInput(""); setError(null); }}
            className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary cursor-pointer whitespace-nowrap"
          >
            Cancel
          </button>
        </div>
        {error && <span className="text-[11px] text-rose-700 dark:text-rose-300">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        {chipId
          ? <span className="font-mono text-[11px] text-foreground" title={chipId}>{chipId.slice(0, 8)}…</span>
          : <span className="text-[11px] text-amber-700 dark:text-amber-400">Not linked</span>}
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={chipId ? `Re-link ${serial}` : `Link ${serial}`}
          title={chipId ? "Re-link (flight controller replaced)" : "Link flight controller"}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
        >
          <Link2 className="h-3 w-3" />
        </button>
        {chipId && (
          <BusyButton
            type="button"
            busy={busy === "unlink"}
            onClick={unlink}
            aria-label={`Unlink ${serial}`}
            title="Unlink"
            icon={<Unlink className="h-3 w-3" />}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary"
          />
        )}
      </div>
      {error && <span className="text-[11px] text-rose-700 dark:text-rose-300">{error}</span>}
    </div>
  );
}
