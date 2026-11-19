"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, CheckCircle2, Lock, MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2, UserPlus, UserRoundCog } from "lucide-react";
import { BusyButton, Spinner } from "@/components/ui/busy";
import { Dialog } from "@/components/ui/dialog";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/status-badge";
import { RenameUserDialog } from "@/components/rename-user-dialog";
import { useAuth } from "@/components/auth-provider";
import { buttonClass, cardClass, fieldClass, labelClass, pageLeadClass, pageTitleClass } from "@/components/ui/styles";
import { AddClientDialog, DeleteClientDialog, RenameClientDialog, blockers, type ClientRow as ClientSummary } from "@/components/client-dialogs";

interface Profile {
  id: string;
  email: string;
  username: string;
  role: string;
  client_id: string | null;
  created_at: string;
}

interface ClientRef {
  id: string;
  name: string;
}

type Level = "admin" | "contributor";

/** The two kinds of AIR6 staff, most access first. */
const LEVELS: { value: Level; name: string; can: string }[] = [
  { value: "admin", name: "Admin", can: "Everything: approves versions and manages models, staff and clients." },
  { value: "contributor", name: "Contributor", can: "Sees every drone and model. The versions they save wait for an admin's review." },
];

const isStaff = (p: Profile): boolean => p.role === "admin" || p.role === "contributor";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Saves who someone is: a staff level, or a person at a client company. */
function useSaveAccess(profileId: string) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(role: string, clientId: string | null): Promise<boolean> {
    setSending(true);
    setError(null);
    const res = await fetch(`/api/admin/users/${profileId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, clientId }),
    }).catch(() => null);
    setSending(false);
    if (!res?.ok) {
      const body = (res ? await res.json().catch(() => ({})) : {}) as { error?: string };
      setError(body.error ?? "That did not save");
      return false;
    }
    startRefresh(() => router.refresh());
    return true;
  }

  return { busy: sending || refreshing, error, save };
}

/** Initials, name (with rename) and e-mail: the same for staff and client people. */
function PersonCell({ profile, isSelf }: { profile: Profile; isSelf: boolean }) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const { setUsername } = useAuth();
  const [renaming, setRenaming] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={profile.username || profile.email} seed={profile.id} size="lg" />
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setRenaming(true)}
            title={`Change the name of ${profile.username}`}
            className="group/name -mx-1 inline-flex min-w-0 items-center gap-1.5 rounded-md px-1 text-sm font-semibold text-foreground hover:bg-secondary cursor-pointer"
          >
            <span className="truncate">{profile.username}</span>
            <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-60 group-hover/name:opacity-100" aria-hidden="true" />
          </button>
          {isSelf && <Badge tone="muted">You</Badge>}
        </div>
        <p className="truncate text-xs text-muted-foreground" title={profile.email || undefined}>{profile.email || "No e-mail"}</p>
      </div>
      {renaming && (
        <RenameUserDialog
          userId={profile.id}
          current={profile.username}
          email={profile.email || null}
          onClose={() => setRenaming(false)}
          onSaved={(next) => {
            setRenaming(false);
            if (isSelf) setUsername(next);
            startRefresh(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}

/** Change access, and delete: the rare actions, kept in one menu per person. */
function PersonMenu({ profile, clients, isSelf }: { profile: Profile; clients: ClientRef[]; isSelf: boolean }) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [open, setOpen] = useState<"access" | "delete" | null>(null);
  const name = profile.username || profile.email;
  return (
    <>
      <Menu align="end" label={`More for ${name}`} trigger={<MoreHorizontal className="h-4 w-4" />} triggerClassName={buttonClass("ghost", "icon")}>
        <MenuItem
          onSelect={() => setOpen("access")}
          disabled={isSelf}
          title={isSelf ? "Another admin can change your access" : undefined}
          icon={<UserRoundCog className="h-3.5 w-3.5" />}
          hint={isStaff(profile) ? "Change level, or move to a client" : "Move to another client, or make staff"}
        >
          Change access…
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          onSelect={() => setOpen("delete")}
          disabled={isSelf}
          title={isSelf ? "You cannot delete your own account" : undefined}
          destructive
          icon={<Trash2 className="h-3.5 w-3.5" />}
        >
          Delete {isStaff(profile) ? "staff member" : "person"}…
        </MenuItem>
      </Menu>
      {open === "access" && <ChangeAccessDialog profile={profile} clients={clients} onClose={() => setOpen(null)} />}
      {open === "delete" && (
        <DeleteUserDialog
          userId={profile.id}
          name={name}
          onClose={() => setOpen(null)}
          onDeleted={() => { setOpen(null); startRefresh(() => router.refresh()); }}
        />
      )}
    </>
  );
}

// Person, level, joined, menu. Phones: person and menu, then level and joined under them.
const STAFF_GRID = "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_10rem_6.5rem_2.25rem]";

function StaffRow({ profile, clients, isSelf }: { profile: Profile; clients: ClientRef[]; isSelf: boolean }) {
  const access = useSaveAccess(profile.id);
  const [savedAt, setSavedAt] = useState(0);
  const selectId = useId();
  const name = profile.username || profile.email;

  useEffect(() => {
    if (!savedAt) return;
    const timer = setTimeout(() => setSavedAt(0), 3000);
    return () => clearTimeout(timer);
  }, [savedAt]);

  return (
    <li className="px-4 py-3">
      <div className={`grid items-center gap-x-4 gap-y-2 ${STAFF_GRID}`}>
        <PersonCell profile={profile} isSelf={isSelf} />
        <div className="col-span-2 row-start-2 flex items-center gap-3 pl-12 sm:col-span-1 sm:row-start-auto sm:pl-0">
          <label htmlFor={selectId} className="sr-only">Level of {name}</label>
          <select
            id={selectId}
            value={profile.role}
            disabled={access.busy || isSelf}
            title={isSelf ? "Another admin can change your level" : undefined}
            onChange={async (e) => { if (await access.save(e.target.value, null)) setSavedAt(Date.now()); }}
            className={`${fieldClass} w-full max-w-40 cursor-pointer`}
          >
            {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.name}</option>)}
          </select>
          <span role="status" className="text-xs sm:hidden">
            {access.busy ? <Spinner /> : savedAt > 0 ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-label="Saved" /> : null}
          </span>
        </div>
        <span className="hidden text-[13px] text-muted-foreground sm:block">
          {access.busy
            ? <span className="flex items-center gap-1.5"><Spinner /> Saving…</span>
            : savedAt > 0
              ? <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Saved</span>
              : formatDate(profile.created_at)}
        </span>
        <span className="col-start-2 row-start-1 flex justify-end sm:col-start-auto sm:row-start-auto">
          <PersonMenu profile={profile} clients={clients} isSelf={isSelf} />
        </span>
      </div>
      {isSelf && (
        <p className="mt-2 flex items-center gap-1.5 pl-12 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden="true" /> Your own level can only be changed by another admin, so you cannot lock yourself out.
        </p>
      )}
      {access.error && <p role="alert" className="mt-2 pl-12 text-[13px] text-destructive">{access.error}</p>}
    </li>
  );
}

function ClientPersonRow({ profile, clients, isSelf }: { profile: Profile; clients: ClientRef[]; isSelf: boolean }) {
  return (
    <li className="flex items-center gap-4 px-4 py-3">
      <div className="min-w-0 flex-1"><PersonCell profile={profile} isSelf={isSelf} /></div>
      <span className="hidden w-26 text-[13px] text-muted-foreground sm:block">{formatDate(profile.created_at)}</span>
      <PersonMenu profile={profile} clients={clients} isSelf={isSelf} />
    </li>
  );
}

type AccessChoice = Level | "client";

/** Moves a person between staff levels and client companies, with each choice spelled out. */
function ChangeAccessDialog({ profile, clients, onClose }: { profile: Profile; clients: ClientRef[]; onClose: () => void }) {
  const access = useSaveAccess(profile.id);
  const [choice, setChoice] = useState<AccessChoice>(isStaff(profile) ? (profile.role as Level) : "client");
  const [clientId, setClientId] = useState(profile.client_id ?? "");
  const name = profile.username || profile.email;
  const group = useId();
  const companyId = useId();
  const unchanged = choice === profile.role && (choice !== "client" || clientId === profile.client_id);
  const ready = !unchanged && (choice !== "client" || !!clientId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    if (await access.save(choice, choice === "client" ? clientId : null)) onClose();
  }

  const option = (value: AccessChoice, title: string, text: string, extra?: React.ReactNode) => (
    <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${choice === value ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/60"}`}>
      <input type="radio" name={group} value={value} checked={choice === value} onChange={() => setChoice(value)} className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{text}</span>
        {extra}
      </span>
    </label>
  );

  return (
    <Dialog
      title={`Change access for ${name}`}
      onClose={onClose}
      busy={access.busy}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={access.busy} className={buttonClass("secondary")}>Cancel</button>
          <BusyButton type="submit" variant="primary" busy={access.busy} busyLabel="Saving…" disabled={!ready}>Save access</BusyButton>
        </>
      }
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-semibold text-foreground">AIR6 staff</legend>
        {LEVELS.map((l) => option(l.value, l.name, l.can))}
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-semibold text-foreground">Client company</legend>
        {option(
          "client",
          "Person at a client",
          "Sees only that company's drones. The versions they save wait for review.",
          choice === "client" && (
            <span className="mt-2 block">
              <label htmlFor={companyId} className="sr-only">Company</label>
              <select id={companyId} value={clientId} onChange={(e) => setClientId(e.target.value)} className={`${fieldClass} w-full cursor-pointer`}>
                <option value="">Choose the company…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </span>
          ),
        )}
      </fieldset>
      {access.error && <p role="alert" className="text-[13px] text-destructive">{access.error}</p>}
    </Dialog>
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

type Tab = "staff" | "clients";
type InviteTarget = { kind: "staff" } | { kind: "client"; client: ClientRef };

/**
 * Who can sign in. Two kinds of people: AIR6 staff, who see every drone, and
 * people at a client company, who see only that company's drones.
 */
export function StaffAndClients({ profiles, clients, currentUserId, initialTab }: {
  profiles: Profile[];
  clients: ClientSummary[];
  currentUserId: string;
  initialTab: Tab;
}) {
  const router = useRouter();
  const [, startRefresh] = useTransition();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [inviting, setInviting] = useState<InviteTarget | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [addingClient, setAddingClient] = useState(false);
  const [renamingClient, setRenamingClient] = useState<ClientSummary | null>(null);
  const [deletingClient, setDeletingClient] = useState<ClientSummary | null>(null);
  const refresh = () => startRefresh(() => router.refresh());

  const staff = profiles.filter(isStaff);
  const clientPeople = profiles.filter((p) => p.role === "client" && p.client_id);
  const noAccess = profiles.filter((p) => !isStaff(p) && !(p.role === "client" && p.client_id));

  function show(next: Tab) {
    setTab(next);
    setSent(null);
    window.history.replaceState(null, "", `/admin/clients?tab=${next}`);
  }

  function invite(target: InviteTarget) {
    setSent(null);
    setInviting(target);
  }

  const tabs: { key: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    { key: "staff", label: "AIR6 staff", count: staff.length, icon: <ShieldCheck className="h-4 w-4" /> },
    { key: "clients", label: "Clients", count: clients.length, icon: <Building2 className="h-4 w-4" /> },
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6">
      <div>
        <h1 className={pageTitleClass}>Staff &amp; clients</h1>
        <p className={`${pageLeadClass} max-w-2xl`}>
          Everyone who signs in is either <span className="font-medium text-foreground">AIR6 staff</span>, who see every drone, or a{" "}
          <span className="font-medium text-foreground">person at a client</span> company, who sees only that company&apos;s drones.
        </p>
      </div>

      <div role="tablist" aria-label="Staff or clients" className="flex h-10 w-fit items-center rounded-lg border border-border bg-secondary p-0.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => show(t.key)}
            className={`flex h-full items-center gap-2 rounded-md px-4 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
              tab === t.key ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon} {t.label}
            <span className="rounded-full bg-border/70 px-1.5 text-xs tabular-nums text-muted-foreground">{t.count}</span>
          </button>
        ))}
      </div>

      {sent && (
        <p role="status" className={`${cardClass} flex items-start gap-2 border-emerald-600/30 px-4 py-3 text-[13px] text-emerald-800 dark:text-emerald-300`}>
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> {sent}
        </p>
      )}

      {tab === "staff" ? (
        <section role="tabpanel" aria-label="AIR6 staff" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-[13px] text-muted-foreground">
              People who work at AIR6. <span className="font-medium text-foreground">Admins</span> approve versions and manage staff and clients;{" "}
              <span className="font-medium text-foreground">contributors</span> see everything, and what they save waits for review.
            </p>
            <button type="button" onClick={() => invite({ kind: "staff" })} className={buttonClass("primary", "md")}>
              <UserPlus className="h-4 w-4" /> Invite staff member
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className={`hidden gap-x-4 px-4 text-xs font-medium text-muted-foreground sm:grid ${STAFF_GRID}`}>
              <span>Person</span>
              <span>Level</span>
              <span>Joined</span>
              <span />
            </div>
            <ul className={`${cardClass} divide-y divide-border`}>
              {staff.map((p) => <StaffRow key={p.id} profile={p} clients={clients} isSelf={p.id === currentUserId} />)}
            </ul>
          </div>
          {noAccess.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5">
              <h2 className="px-1 text-sm font-semibold text-foreground">No access</h2>
              <p className="px-1 text-[13px] text-muted-foreground">These accounts can sign in but see nothing. Give them access, or delete them.</p>
              <ul className={`${cardClass} divide-y divide-border`}>
                {noAccess.map((p) => <ClientPersonRow key={p.id} profile={p} clients={clients} isSelf={p.id === currentUserId} />)}
              </ul>
            </div>
          )}
        </section>
      ) : (
        <section role="tabpanel" aria-label="Clients" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-[13px] text-muted-foreground">
              Companies that own drones. Each one&apos;s people see only that company&apos;s drones, and what they save waits for review.
            </p>
            <button type="button" onClick={() => setAddingClient(true)} className={buttonClass("primary", "md")}>
              <Plus className="h-4 w-4" /> Add client
            </button>
          </div>
          {clients.length === 0 && (
            <div className={`${cardClass} px-6 py-14 text-center text-sm text-muted-foreground`}>No clients yet.</div>
          )}
          {clients.map((c) => {
            const people = clientPeople.filter((p) => p.client_id === c.id);
            const blocked = blockers(c);
            return (
              <section key={c.id} aria-label={c.name} className={cardClass}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-foreground">{c.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      {c.drones > 0
                        ? <Link href={`/?client=${c.id}`} className="font-medium text-primary hover:underline cursor-pointer whitespace-nowrap">{c.drones} drone{c.drones === 1 ? "" : "s"} →</Link>
                        : "No drones yet"}
                      {" · "}{people.length} {people.length === 1 ? "person" : "people"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label={`Rename ${c.name}`} title={`Rename ${c.name}`} onClick={() => setRenamingClient(c)} className={buttonClass("ghost", "icon")}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${c.name}`}
                      title={blocked.length ? `Cannot be deleted yet: ${blocked[0].reason.toLowerCase()}` : `Delete ${c.name}`}
                      onClick={() => setDeletingClient(c)}
                      className={buttonClass("dangerGhost", "icon")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="rounded-b-xl border-t border-border bg-secondary/30">
                  <h3 className="px-4 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">People at {c.name}</h3>
                  {people.length > 0 ? (
                    <ul className="divide-y divide-border">
                      {people.map((p) => <ClientPersonRow key={p.id} profile={p} clients={clients} isSelf={p.id === currentUserId} />)}
                    </ul>
                  ) : (
                    <p className="px-4 pb-1 pt-1 text-[13px] text-muted-foreground">Nobody from {c.name} can sign in yet.</p>
                  )}
                  <div className="px-3 py-2">
                    <button type="button" onClick={() => invite({ kind: "client", client: c })} className={buttonClass("ghost", "sm")}>
                      <UserPlus className="h-3.5 w-3.5" /> Invite someone from {c.name}
                    </button>
                  </div>
                </div>
              </section>
            );
          })}
        </section>
      )}

      {inviting && (
        <InviteDialog
          target={inviting}
          onClose={() => setInviting(null)}
          onSent={(message) => { setInviting(null); setSent(message); refresh(); }}
        />
      )}
      {addingClient && <AddClientDialog onClose={() => setAddingClient(false)} onDone={() => { setAddingClient(false); refresh(); }} />}
      {renamingClient && <RenameClientDialog client={renamingClient} onClose={() => setRenamingClient(null)} onDone={() => { setRenamingClient(null); refresh(); }} />}
      {deletingClient && <DeleteClientDialog client={deletingClient} onClose={() => setDeletingClient(null)} onDone={() => { setDeletingClient(null); refresh(); }} />}
    </div>
  );
}

/** Invite a staff member, or someone from one client company. */
function InviteDialog({ target, onClose, onSent }: { target: InviteTarget; onClose: () => void; onSent: (message: string) => void }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [level, setLevel] = useState<Level>("contributor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { name: useId(), nameHint: useId(), email: useId(), level: useId() };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        name: fullName.trim() || null,
        role: target.kind === "staff" ? level : "client",
        clientId: target.kind === "client" ? target.client.id : null,
      }),
    }).catch(() => null);
    const body = (res ? await res.json().catch(() => ({})) : {}) as { error?: string; resent?: boolean };
    setBusy(false);
    if (!res?.ok) {
      setError(body.error ?? "Failed to send invite");
      return;
    }
    onSent(body.resent
      ? `${email.trim()} already had an account: a fresh sign-in link was sent and their access updated.`
      : `Invite sent to ${email.trim()}. They get an e-mail with a link to sign in.`);
  }

  return (
    <Dialog
      title={target.kind === "staff" ? "Invite a staff member" : `Invite someone from ${target.client.name}`}
      onClose={onClose}
      busy={busy}
      onSubmit={submit}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={buttonClass("secondary")}>Cancel</button>
          <BusyButton type="submit" variant="primary" busy={busy} busyLabel="Sending…" disabled={!email.trim()} icon={<UserPlus className="h-3.5 w-3.5" />}>
            Send invite
          </BusyButton>
        </>
      }
    >
      <p className="-mt-1 text-[13px] text-muted-foreground">
        {target.kind === "staff"
          ? "They will see every drone and model."
          : <>They will see only {target.client.name}&apos;s drones. What they save waits for review.</>}
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.name} className={labelClass}>
          Name and surname <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <input id={ids.name} value={fullName} maxLength={40} aria-describedby={ids.nameHint} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Carla Gómez" className={`${fieldClass} w-full`} />
        <p id={ids.nameHint} className="text-xs text-muted-foreground">Their account is created with this name. Left empty, the start of the e-mail is used.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={ids.email} className={labelClass}>Email</label>
        <input id={ids.email} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" className={`${fieldClass} w-full`} />
      </div>
      {target.kind === "staff" && (
        <fieldset className="flex flex-col gap-2">
          <legend className={`${labelClass} mb-1.5`}>Level</legend>
          {LEVELS.map((l) => (
            <label key={l.value} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${level === l.value ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/60"}`}>
              <input type="radio" name={ids.level} value={l.value} checked={level === l.value} onChange={() => setLevel(l.value)} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium text-foreground">{l.name}</span>
                <span className="block text-xs text-muted-foreground">{l.can}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      {error && <p role="alert" className="text-[13px] text-destructive">{error}</p>}
    </Dialog>
  );
}
