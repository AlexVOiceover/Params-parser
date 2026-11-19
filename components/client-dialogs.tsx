"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { BusyButton } from "@/components/ui/busy";
import { Dialog } from "@/components/ui/dialog";
import { buttonClass, fieldClass, labelClass } from "@/components/ui/styles";

export interface ClientRow {
  id: string;
  name: string;
  drones: number;
  users: number;
  /** Drone histories that still name this client without belonging to one of its drones. */
  histories: number;
}

/** Sends one change and returns the error to show, or null when it worked. */
async function send(url: string, method: "POST" | "PATCH" | "DELETE", body?: { name: string }): Promise<string | null> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  if (res?.ok) return null;
  const answer = (res ? await res.json().catch(() => ({})) : {}) as { error?: string };
  return answer.error ?? "That did not work";
}

interface Blocker { key: string; title: string; hint: string; reason: string; link?: { href: string; label: string } }

/** Why the server would refuse to delete this client. Empty when it can be deleted. */
export function blockers(c: ClientRow): Blocker[] {
  const list: Blocker[] = [];
  if (c.drones > 0) {
    list.push({
      key: "drones",
      title: c.drones === 1 ? "1 drone belongs to it" : `${c.drones} drones belong to it`,
      hint: "Move them to another client, or delete them, from each drone's page.",
      reason: "Move or delete its drones first",
      link: { href: `/?client=${c.id}`, label: c.drones === 1 ? "Show the drone" : "Show the drones" },
    });
  }
  if (c.users > 0) {
    list.push({
      key: "users",
      title: c.users === 1 ? "1 person signs in under it" : `${c.users} people sign in under it`,
      hint: "They are listed on its card. Someone at a client always needs a client: move them with Change access, or delete them.",
      reason: "Move or delete its people first",
    });
  }
  if (c.histories > 0) {
    list.push({
      key: "histories",
      title: c.histories === 1 ? "1 drone history still belongs to it" : `${c.histories} drone histories still belong to it`,
      hint: "A client that still has drone histories cannot be deleted.",
      reason: "It still has drone histories",
    });
  }
  return list;
}

/** A new client company. */
export function AddClientDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const failed = await send("/api/admin/clients", "POST", { name: name.trim() });
    if (failed) {
      setBusy(false);
      setError(failed);
      return;
    }
    onDone();
  }

  return (
    <Dialog
      title="Add client"
      size="sm"
      onClose={onClose}
      busy={busy}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass("secondary")}>Cancel</button>
          <BusyButton type="submit" variant="primary" busy={busy} busyLabel="Adding…" disabled={!name.trim()}>Add client</BusyButton>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className={labelClass}>Company name</label>
        <input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Hansab" className={`${fieldClass} w-full`} />
        <p className="text-xs text-muted-foreground">Then invite its people, and assign its drones from each drone&apos;s page.</p>
      </div>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </Dialog>
  );
}

interface ClientDialogProps {
  client: ClientRow;
  onClose: () => void;
  onDone: () => void;
}

export function RenameClientDialog({ client, onClose, onDone }: ClientDialogProps) {
  const [name, setName] = useState(client.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();

  // Start in the field with the old name selected, ready to be typed over.
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const failed = await send(`/api/admin/clients/${client.id}`, "PATCH", { name: name.trim() });
    if (failed) {
      setBusy(false);
      setError(failed);
      return;
    }
    onDone();
  }

  return (
    <Dialog
      title="Rename client"
      size="sm"
      onClose={onClose}
      busy={busy}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass("secondary")}>Cancel</button>
          <BusyButton type="submit" variant="primary" busy={busy} busyLabel="Saving…">Save</BusyButton>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className={labelClass}>Client name</label>
        <input ref={input} id={id} value={name} onChange={(e) => setName(e.target.value)} className={`${fieldClass} w-full`} />
        <p className="text-xs text-muted-foreground">Its drones and people stay with it under the new name.</p>
      </div>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </Dialog>
  );
}

export function DeleteClientDialog({ client, onClose, onDone }: ClientDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = blockers(client);

  async function remove() {
    setBusy(true);
    setError(null);
    const failed = await send(`/api/admin/clients/${client.id}`, "DELETE");
    if (failed) {
      setBusy(false);
      setError(failed);
      return;
    }
    onDone();
  }

  if (blocked.length > 0) {
    return (
      <Dialog
        title={`${client.name} cannot be deleted yet`}
        onClose={onClose}
        footer={<button type="button" onClick={onClose} className={buttonClass("secondary")}>Close</button>}
      >
        <p className="text-sm text-foreground">A client can only be deleted once nothing belongs to it any more.</p>
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {blocked.map((b) => (
            <li key={b.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
              <span className="min-w-0 flex-1 basis-56">
                <span className="block text-sm font-medium text-foreground">{b.title}</span>
                <span className="block text-[13px] text-muted-foreground">{b.hint}</span>
              </span>
              {b.link && <Link href={b.link.href} className={buttonClass("secondary")}>{b.link.label}</Link>}
            </li>
          ))}
        </ul>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={`Delete ${client.name}?`}
      size="sm"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass("secondary")}>Cancel</button>
          <BusyButton type="button" variant="danger" busy={busy} busyLabel="Deleting…" onClick={remove}>Delete client</BusyButton>
        </>
      }
    >
      <p className="text-sm text-foreground">
        <span className="font-semibold">{client.name}</span> has no drones and no people, so nothing else is removed with it.
      </p>
      <p className="text-[13px] text-muted-foreground">This cannot be undone.</p>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </Dialog>
  );
}
