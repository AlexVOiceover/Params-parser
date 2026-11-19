"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, ChevronRight, Trash2, UserPlus } from "lucide-react";
import { BusyButton, Spinner } from "@/components/ui/busy";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/status-badge";
import { buttonClass, cardClass, fieldClass, labelClass, pageLeadClass, pageTitleClass, sectionTitleClass } from "@/components/ui/styles";

interface Profile {
  id: string;
  email: string;
  username: string;
  role: string;
  client_id: string | null;
  created_at: string;
}

interface ClientRow {
  id: string;
  name: string;
}

interface Props {
  profiles: Profile[];
  clients: ClientRow[];
  currentUserId: string;
}

type Role = "admin" | "contributor" | "client" | "viewer";

/** Every role, most access first, with what it may do. */
const ROLES: { value: Role; name: string; can: string }[] = [
  { value: "admin", name: "Admin", can: "Everything: approves versions, and manages models, clients and users." },
  { value: "contributor", name: "Contributor", can: "AIR6 staff. Sees every drone and model; the versions they save wait for review." },
  { value: "client", name: "Client", can: "Sees only their own company's drones. The versions they save wait for review." },
  { value: "viewer", name: "Viewer", can: "Can sign in but sees no drones. Only for existing users, not for invites." },
];

// Phones: e-mail and delete on one line, everything else stacked. From lg up: one line, seven columns.
const USER_GRID =
  "grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(13rem,1.5fr)_minmax(7rem,0.9fr)_9.5rem_minmax(10rem,1.1fr)_4.5rem_6rem_2rem]";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function ClientOptions({ clients }: { clients: ClientRow[] }) {
  return (
    <>
      <option value="">Choose a client…</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>{c.name}</option>
      ))}
    </>
  );
}

function UserRow({ profile, clients, isSelf }: { profile: Profile; clients: ClientRow[]; isSelf: boolean }) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  // What the selects show while it differs from what is stored: a choice being saved, refused, or not yet complete.
  const [draft, setDraft] = useState<{ role: string; clientId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const usedSelect = useRef<HTMLSelectElement | null>(null);
  const ids = { role: useId(), client: useId(), note: useId() };
  const name = profile.email || profile.username;

  // Once the refreshed page carries the stored values, the draft has done its job.
  const stored = `${profile.role}|${profile.client_id ?? ""}`;
  const [seen, setSeen] = useState(stored);
  if (seen !== stored) {
    setSeen(stored);
    setDraft(null);
  }

  useEffect(() => {
    if (!savedAt) return;
    const timer = setTimeout(() => setSavedAt(0), 3000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  const role = draft?.role ?? profile.role;
  const clientId = draft ? draft.clientId : profile.client_id ?? "";
  // Becoming a client user is only saved together with the company it belongs to.
  const choosingClient = role === "client" && profile.role !== "client";
  const locked = saving || refreshing;

  // A select is disabled while its change is saved, which drops the keyboard focus: hand it back afterwards.
  useEffect(() => {
    if (locked) return;
    const select = usedSelect.current;
    usedSelect.current = null;
    if (select && (document.activeElement === document.body || document.activeElement === select)) select.focus();
  }, [locked]);

  async function patch(nextRole: string, nextClientId: string | null) {
    setSaving(true);
    setError(null);
    setSavedAt(0);
    const res = await fetch(`/api/admin/users/${profile.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole, clientId: nextClientId }),
    }).catch(() => null);
    if (!res?.ok) {
      const body = (res ? await res.json().catch(() => ({})) : {}) as { error?: string };
      setSaving(false);
      setError(body.error ?? "Update failed");
      return;
    }
    startRefresh(() => router.refresh());
    setSaving(false);
    setSavedAt(Date.now());
  }

  function handleRoleChange(nextRole: string) {
    setError(null);
    if (nextRole === profile.role) {
      setDraft(null);
    } else if (nextRole === "client") {
      setDraft({ role: nextRole, clientId: "" });
      if (clients.length === 0) setError("Create a client first.");
    } else {
      setDraft({ role: nextRole, clientId: "" });
      patch(nextRole, null);
    }
  }

  function handleClientChange(nextClientId: string) {
    setDraft({ role: "client", clientId: nextClientId });
    if (!choosingClient && nextClientId) patch("client", nextClientId);
  }

  function cancelDraft() {
    setDraft(null);
    setError(null);
  }

  return (
    <li>
      <div className={`grid items-center gap-x-3 gap-y-2 px-4 py-3 lg:py-2.5 ${USER_GRID}`}>
        <span className="flex min-w-0 items-center gap-2">
          <span className={`truncate text-sm font-medium ${profile.email ? "text-foreground" : "text-muted-foreground"}`} title={profile.email || undefined}>
            {profile.email || "No e-mail"}
          </span>
          {isSelf && <Badge tone="muted">You</Badge>}
        </span>
        <span className="hidden truncate font-mono text-[13px] text-foreground lg:block">{profile.username}</span>

        <div className="col-span-2 flex flex-col sm:flex-row sm:items-center lg:contents">
          <div className="sm:w-44 lg:w-auto">
            <label htmlFor={ids.role} className="sr-only">Role of {name}</label>
            <select
              id={ids.role}
              value={role}
              disabled={locked}
              onChange={(e) => { usedSelect.current = e.currentTarget; handleRoleChange(e.target.value); }}
              className={`${fieldClass} w-full cursor-pointer`}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.name}</option>
              ))}
            </select>
          </div>
          {role === "client" ? (
            <div className="mt-2 sm:ml-2 sm:mt-0 sm:w-64 lg:m-0 lg:w-auto">
              <label htmlFor={ids.client} className="sr-only">Client of {name}</label>
              <select
                id={ids.client}
                value={clientId}
                disabled={locked}
                aria-describedby={choosingClient ? ids.note : undefined}
                onChange={(e) => { usedSelect.current = e.currentTarget; handleClientChange(e.target.value); }}
                className={`${fieldClass} w-full cursor-pointer`}
              >
                <ClientOptions clients={clients} />
              </select>
            </div>
          ) : (
            <span className="hidden text-[13px] text-muted-foreground lg:block" aria-hidden="true">—</span>
          )}
          <span role="status" className="text-xs">
            {saving && !choosingClient && (
              <span className="mt-2 flex items-center gap-1.5 text-muted-foreground sm:ml-3 sm:mt-0 lg:ml-0">
                <Spinner /> Saving…
              </span>
            )}
            {!saving && !choosingClient && savedAt > 0 && (
              <span className="mt-2 flex items-center gap-1 font-medium text-emerald-700 sm:ml-3 sm:mt-0 lg:ml-0 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Saved
              </span>
            )}
          </span>
        </div>

        <span className="hidden text-[13px] text-muted-foreground lg:block">{formatDate(profile.created_at)}</span>
        <span className="col-start-2 row-start-1 flex justify-end lg:col-start-auto lg:row-start-auto">
          <button
            ref={deleteButton}
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={refreshing || isSelf}
            title={isSelf ? "You cannot delete your own account" : `Delete ${name}`}
            aria-label={`Delete ${name}`}
            className={buttonClass("dangerGhost", "icon")}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </span>
        <p className="col-span-2 row-start-2 text-xs text-muted-foreground lg:hidden">
          <span className="font-mono">{profile.username}</span> · Joined {formatDate(profile.created_at)}
        </p>
      </div>

      {choosingClient && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border bg-secondary/50 px-4 py-2.5">
          <p id={ids.note} className="min-w-0 flex-1 basis-64 text-[13px] text-foreground">
            <span className="font-medium">Not saved yet.</span> Choose the client this user belongs to: they will see only that client&apos;s drones.
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={cancelDraft} disabled={locked} className={buttonClass("secondary")}>Cancel</button>
            <BusyButton type="button" variant="primary" busy={locked} busyLabel="Saving…" disabled={!clientId} onClick={() => patch("client", clientId)}>
              Save
            </BusyButton>
          </div>
        </div>
      )}
      {error && <p role="alert" className="px-4 pb-3 text-[13px] text-destructive">{error}</p>}

      {confirmDelete && (
        <DeleteUserDialog
          userId={profile.id}
          name={name}
          onClose={() => { setConfirmDelete(false); deleteButton.current?.focus(); }}
          onDeleted={() => { setConfirmDelete(false); startRefresh(() => router.refresh()); }}
        />
      )}
    </li>
  );
}

function DeleteUserDialog({ userId, name, onClose, onDeleted }: { userId: string; name: string; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      const body = (res ? await res.json().catch(() => ({})) : {}) as { error?: string };
      setBusy(false);
      setError(body.error ?? "Delete failed");
      return;
    }
    onDeleted();
  }

  return (
    <Dialog
      title="Delete user"
      size="sm"
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass("secondary")}>Cancel</button>
          <BusyButton type="button" variant="danger" busy={busy} busyLabel="Deleting…" onClick={remove}>Delete user</BusyButton>
        </>
      }
    >
      <p className="text-sm text-foreground">
        Delete <span className="break-all font-semibold">{name}</span>? This removes their account permanently.
      </p>
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </Dialog>
  );
}

export function AdminDashboard({ profiles, clients, currentUserId }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("contributor");
  const [clientId, setClientId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  // True when the email already had an account and we sent a fresh link.
  const [inviteResent, setInviteResent] = useState(false);
  const ids = { email: useId(), role: useId(), client: useId() };

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    if (role === "client" && !clientId) {
      setInviteError("Pick a client.");
      return;
    }
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        role,
        clientId: role === "client" ? clientId : null,
      }),
    }).catch(() => null);
    setInviting(false);
    const body = (res ? await res.json().catch(() => ({})) : {}) as { error?: string; resent?: boolean };
    if (res?.ok) {
      setEmail("");
      setRole("contributor");
      setClientId("");
      setInviteResent(body.resent === true);
      setInviteSuccess(true);
      router.refresh();
    } else {
      setInviteError(body.error ?? "Failed to send invite");
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div>
        <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Link href="/" className="hover:text-foreground hover:underline cursor-pointer whitespace-nowrap">Drones</Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span aria-current="page" className="font-medium text-foreground">Users</span>
        </nav>
        <h1 className={pageTitleClass}>Users</h1>
        <p className={pageLeadClass}>
          {profiles.length} user{profiles.length === 1 ? "" : "s"} · Their role decides what each of them can see and do.
        </p>
      </div>

      <section className={`${cardClass} grid gap-x-8 gap-y-5 p-5 lg:grid-cols-2`}>
        <form onSubmit={handleInvite} className="flex flex-col gap-4">
          <div>
            <h2 className={sectionTitleClass}>Invite user</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">They get an e-mail with a link to sign in.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.email} className={labelClass}>Email</label>
              <input
                id={ids.email}
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setInviteSuccess(false); setInviteResent(false); setInviteError(null); }}
                placeholder="user@example.com"
                className={`${fieldClass} w-full`}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.role} className={labelClass}>Role</label>
              <select
                id={ids.role}
                value={role}
                onChange={(e) => { setRole(e.target.value); setClientId(""); setInviteError(null); }}
                className={`${fieldClass} w-full cursor-pointer`}
              >
                {ROLES.filter((r) => r.value !== "viewer").map((r) => (
                  <option key={r.value} value={r.value}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
          {role === "client" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.client} className={labelClass}>Client</label>
              <select
                id={ids.client}
                required
                value={clientId}
                onChange={(e) => { setClientId(e.target.value); setInviteError(null); }}
                className={`${fieldClass} w-full cursor-pointer`}
              >
                <ClientOptions clients={clients} />
              </select>
              <p className="text-xs text-muted-foreground">They will see only this client&apos;s drones.</p>
            </div>
          )}
          <div>
            <BusyButton
              type="submit"
              variant="primary"
              busy={inviting}
              busyLabel="Sending…"
              disabled={!email.trim() || (role === "client" && !clientId)}
              icon={<UserPlus className="h-3.5 w-3.5" />}
            >
              Send magic-link invite
            </BusyButton>
          </div>
          {inviteSuccess && (
            <p role="status" className="flex items-start gap-1.5 text-[13px] text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {inviteResent
                ? "This email already had an account — a fresh sign-in link has been sent and the role updated."
                : "Invite sent — they'll receive an email with a sign-in link."}
            </p>
          )}
          {inviteError && <p role="alert" className="text-[13px] text-destructive">{inviteError}</p>}
        </form>

        <div className="rounded-lg bg-secondary/60 px-4 py-3.5">
          <h3 className="text-[13px] font-semibold text-foreground">What each role can do</h3>
          <dl className="mt-2.5 flex flex-col gap-2.5">
            {ROLES.map((r) => (
              <div key={r.value} className="grid gap-x-3 text-[13px] leading-snug sm:grid-cols-[5.5rem_minmax(0,1fr)]">
                <dt className="font-medium text-foreground">{r.name}</dt>
                <dd className="text-muted-foreground">{r.can}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <div className={`hidden items-center gap-x-3 px-4 text-xs font-medium text-muted-foreground lg:grid ${USER_GRID}`}>
          <span>Email</span>
          <span>Username</span>
          <span>Role</span>
          <span>Client</span>
          <span />
          <span>Joined</span>
          <span />
        </div>
        <ul className={`${cardClass} divide-y divide-border overflow-hidden`}>
          {profiles.map((p) => (
            <UserRow key={p.id} profile={p} clients={clients} isSelf={p.id === currentUserId} />
          ))}
        </ul>
      </div>
    </div>
  );
}
