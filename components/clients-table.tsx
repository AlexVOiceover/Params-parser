"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { BusyButton } from "@/components/ui/busy";
import { Dialog } from "@/components/ui/dialog";
import { buttonClass, cardClass, fieldClass, labelClass, pageLeadClass, pageTitleClass } from "@/components/ui/styles";

export interface ClientRow {
  id: string;
  name: string;
  drones: number;
  users: number;
  /** Drone histories that still name this client without belonging to one of its drones. */
  histories: number;
}

// Phones: name and actions on one line, the counts under it. From sm up: one line, four columns.
const ROW_GRID = "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(12rem,2fr)_minmax(7rem,1fr)_minmax(6rem,1fr)_4.25rem]";

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
function blockers(c: ClientRow): Blocker[] {
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
      title: c.users === 1 ? "1 user signs in under it" : `${c.users} users sign in under it`,
      hint: "A client user always needs a client: give them another one, or delete them.",
      reason: "Move or delete its users first",
      link: { href: "/admin", label: "Open Users" },
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

/** Client companies. Their drones are managed on the Drones list, filtered by client. */
export function ClientsTable({ clients }: { clients: ClientRow[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<ClientRow | null>(null);
  const [deleting, setDeleting] = useState<ClientRow | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const newId = useId();

  const refresh = () => startTransition(() => router.refresh());

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    const failed = await send("/api/admin/clients", "POST", { name: newName.trim() });
    setAdding(false);
    if (failed) { setAddError(failed); return; }
    setNewName("");
    refresh();
  }

  function open(e: React.MouseEvent<HTMLButtonElement>, set: (c: ClientRow) => void, c: ClientRow) {
    opener.current = e.currentTarget;
    setAddError(null);
    set(c);
  }
  // A closed dialog hands the keyboard back to the button that opened it.
  function close() {
    setRenaming(null);
    setDeleting(null);
    opener.current?.focus();
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className={pageTitleClass}>Clients</h1>
          <p className={`${pageLeadClass} max-w-xl`}>
            Companies that own drones. Their users only ever see their own drones. Assign a drone to a client from the drone&apos;s page.
          </p>
        </div>
        <form onSubmit={add} className="flex w-full flex-col gap-1.5 sm:w-auto">
          <div className="flex items-center gap-2">
            <label htmlFor={newId} className="sr-only">New client name</label>
            <input
              id={newId}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New client name"
              className={`${fieldClass} min-w-0 flex-1 sm:w-60 sm:flex-none`}
            />
            <BusyButton type="submit" variant="primary" size="md" busy={adding} busyLabel="Adding…" disabled={!newName.trim()} icon={<Plus className="h-4 w-4" />}>
              Add client
            </BusyButton>
          </div>
          {addError && <p role="alert" className="text-[13px] text-destructive">{addError}</p>}
        </form>
      </div>

      {clients.length === 0 ? (
        <div className={`${cardClass} px-6 py-14 text-center`}>
          <p className="text-sm text-muted-foreground">No clients yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className={`hidden items-center gap-x-4 px-4 text-xs font-medium text-muted-foreground sm:grid ${ROW_GRID}`}>
            <span>Client</span>
            <span>Drones</span>
            <span>Users</span>
            <span />
          </div>
          <ul className={`${cardClass} divide-y divide-border overflow-hidden`}>
            {clients.map((c) => {
              const blocked = blockers(c);
              return (
                <li key={c.id} className={`grid items-center gap-x-4 gap-y-1 px-4 py-3 sm:py-2.5 ${ROW_GRID}`}>
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span className="truncate text-sm font-semibold text-foreground">{c.name}</span>
                  </span>
                  <span className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-11 text-[13px] sm:contents">
                    <span>
                      {c.drones > 0
                        ? <Link href={`/?client=${c.id}`} className="font-medium text-primary hover:underline cursor-pointer whitespace-nowrap">{c.drones} drone{c.drones === 1 ? "" : "s"} →</Link>
                        : <span className="text-muted-foreground">No drones</span>}
                    </span>
                    <span className="text-muted-foreground">
                      {c.users > 0 ? `${c.users} user${c.users === 1 ? "" : "s"}` : "No users"}
                    </span>
                  </span>
                  <span className="col-start-2 row-start-1 flex items-center justify-end gap-1 sm:col-start-auto sm:row-start-auto">
                    <button
                      type="button"
                      aria-label={`Rename ${c.name}`}
                      title={`Rename ${c.name}`}
                      onClick={(e) => open(e, setRenaming, c)}
                      className={buttonClass("ghost", "icon")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${c.name}`}
                      title={blocked.length ? `Cannot be deleted yet: ${blocked[0].reason.toLowerCase()}` : `Delete ${c.name}`}
                      onClick={(e) => open(e, setDeleting, c)}
                      className={buttonClass("dangerGhost", "icon")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {renaming && <RenameClientDialog client={renaming} onClose={close} onDone={() => { close(); refresh(); }} />}
      {deleting && <DeleteClientDialog client={deleting} onClose={close} onDone={() => { close(); refresh(); }} />}
    </div>
  );
}

interface ClientDialogProps {
  client: ClientRow;
  onClose: () => void;
  onDone: () => void;
}

function RenameClientDialog({ client, onClose, onDone }: ClientDialogProps) {
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
        <p className="text-xs text-muted-foreground">Its drones and users stay with it under the new name.</p>
      </div>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </Dialog>
  );
}

function DeleteClientDialog({ client, onClose, onDone }: ClientDialogProps) {
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
        <span className="font-semibold">{client.name}</span> has no drones and no users, so nothing else is removed with it.
      </p>
      <p className="text-[13px] text-muted-foreground">This cannot be undone.</p>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </Dialog>
  );
}
