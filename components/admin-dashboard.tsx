"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, ChevronRight, Trash2 } from "lucide-react";

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

const ROLES = ["viewer", "contributor", "admin", "client"] as const;

function RoleClientCell({
  userId,
  currentRole,
  currentClientId,
  clients,
}: {
  userId: string;
  currentRole: string;
  currentClientId: string | null;
  clients: ClientRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState(currentRole);
  const [clientId, setClientId] = useState(currentClientId ?? "");
  const [error, setError] = useState<string | null>(null);

  async function patch(nextRole: string, nextClientId: string | null) {
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole, clientId: nextClientId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? "Update failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function handleRoleChange(nextRole: string) {
    if (nextRole === "client") {
      // Need a client picked before we can save. Default to the first one;
      // the user can change it via the client select that appears.
      const first = clients[0]?.id ?? "";
      setRole(nextRole);
      setClientId(first);
      if (first) await patch(nextRole, first);
      else setError("Create a client first.");
    } else {
      setRole(nextRole);
      setClientId("");
      await patch(nextRole, null);
    }
  }

  async function handleClientChange(nextClientId: string) {
    setClientId(nextClientId);
    if (role === "client" && nextClientId) {
      await patch("client", nextClientId);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <select
          value={role}
          disabled={pending}
          onChange={(e) => handleRoleChange(e.target.value)}
          className="rounded border border-border bg-secondary px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer disabled:opacity-50"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {role === "client" && (
          <select
            value={clientId}
            disabled={pending}
            onChange={(e) => handleClientChange(e.target.value)}
            className="rounded border border-border bg-secondary px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer disabled:opacity-50"
          >
            <option value="">Pick a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}

function DeleteUserButton({ userId, email, isSelf }: { userId: string; email: string; isSelf: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (isSelf) return;
    if (!window.confirm(`Delete ${email}? This removes their account permanently.`)) return;
    setError(null);
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body?.error ?? "Delete failed");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending || isSelf}
        title={isSelf ? "You cannot delete your own account" : "Delete user"}
        aria-label="Delete user"
        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {error && <span className="text-[10px] text-destructive">{error}</span>}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function AdminDashboard({ profiles, clients, currentUserId }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("contributor");
  const [clientId, setClientId] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

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
    });
    setInviting(false);
    if (res.ok) {
      setEmail("");
      setRole("contributor");
      setClientId("");
      setInviteSuccess(true);
      router.refresh();
    } else {
      const { error } = await res.json();
      setInviteError(error ?? "Failed to send invite");
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors cursor-pointer">Catalog</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Admin</span>
      </nav>
      <div className="flex flex-col gap-8">
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">
          Users <span className="text-muted-foreground font-normal text-sm">({profiles.length})</span>
        </h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Email</th>
                <th className="px-4 py-2.5 text-left font-medium">Username</th>
                <th className="px-4 py-2.5 text-left font-medium">Role / Client</th>
                <th className="px-4 py-2.5 text-left font-medium">Joined</th>
                <th className="px-4 py-2.5 text-right font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p, i) => (
                <tr key={p.id} className={`${i !== profiles.length - 1 ? "border-b border-border" : ""}`}>
                  <td className="px-4 py-2.5 text-foreground">{p.email}</td>
                  <td className="px-4 py-2.5 font-mono text-foreground">{p.username}</td>
                  <td className="px-4 py-2.5">
                    <RoleClientCell
                      userId={p.id}
                      currentRole={p.role}
                      currentClientId={p.client_id}
                      clients={clients}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDate(p.created_at)}</td>
                  <td className="px-2 py-2.5 text-right">
                    <DeleteUserButton userId={p.id} email={p.email} isSelf={p.id === currentUserId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Invite user</h2>
        <form onSubmit={handleInvite} className="flex flex-col gap-2 max-w-md">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); setInviteSuccess(false); setInviteError(null); }}
              placeholder="user@example.com"
              className="flex-1 min-w-48 rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
            />
            <select
              value={role}
              onChange={(e) => { setRole(e.target.value); setClientId(""); setInviteError(null); }}
              className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {ROLES.filter((r) => r !== "viewer").map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          {role === "client" && (
            <select
              required
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setInviteError(null); }}
              className="rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              <option value="">Pick a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <div>
            <button
              type="submit"
              disabled={inviting || !email.trim() || (role === "client" && !clientId)}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {inviting ? "Sending…" : "Send magic-link invite"}
            </button>
          </div>
        </form>
        {inviteSuccess && (
          <p className="mt-2 text-xs text-green-400">Invite sent — they'll receive an email with a sign-in link.</p>
        )}
        {inviteError && (
          <p className="mt-2 text-xs text-destructive">{inviteError}</p>
        )}
      </section>
      </div>
    </div>
  );
}
