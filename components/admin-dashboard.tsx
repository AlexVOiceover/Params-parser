"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";

interface Profile {
  id: string;
  email: string;
  username: string;
  role: string;
  created_at: string;
}

interface Props {
  profiles: Profile[];
}

function RoleSelect({ userId, currentRole }: { userId: string; currentRole: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [role, setRole] = useState(currentRole);

  async function handleChange(newRole: string) {
    setRole(newRole);
    await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <select
      value={role}
      disabled={pending}
      onChange={(e) => handleChange(e.target.value)}
      className="rounded border border-border bg-secondary px-2 py-1 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring cursor-pointer disabled:opacity-50"
    >
      <option value="viewer">viewer</option>
      <option value="contributor">contributor</option>
      <option value="admin">admin</option>
    </select>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function AdminDashboard({ profiles }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    setInviting(false);
    if (res.ok) {
      setEmail("");
      setInviteSuccess(true);
      router.refresh();
    } else {
      const { error } = await res.json();
      setInviteError(error ?? "Failed to send invite");
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-8">
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
                <th className="px-4 py-2.5 text-left font-medium">Role</th>
                <th className="px-4 py-2.5 text-left font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p, i) => (
                <tr key={p.id} className={`${i !== profiles.length - 1 ? "border-b border-border" : ""}`}>
                  <td className="px-4 py-2.5 text-foreground">{p.email}</td>
                  <td className="px-4 py-2.5 font-mono text-foreground">{p.username}</td>
                  <td className="px-4 py-2.5">
                    <RoleSelect userId={p.id} currentRole={p.role} />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDate(p.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Invite user</h2>
        <form onSubmit={handleInvite} className="flex items-center gap-2 max-w-md">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => { setEmail(e.target.value); setInviteSuccess(false); setInviteError(null); }}
            placeholder="user@example.com"
            className="flex-1 rounded-md border border-border bg-secondary px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={inviting || !email.trim()}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {inviting ? "Sending…" : "Send invite"}
          </button>
        </form>
        {inviteSuccess && (
          <p className="mt-2 text-xs text-green-400">Invite sent — they'll receive an email to set up their account.</p>
        )}
        {inviteError && (
          <p className="mt-2 text-xs text-destructive-foreground">{inviteError}</p>
        )}
      </section>
    </div>
  );
}
