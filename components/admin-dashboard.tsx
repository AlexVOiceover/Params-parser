"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  username: string;
  role: string;
  created_at: string;
}

interface ParamSetRow {
  id: string;
  name: string;
  published: boolean;
  created_at: string;
  drone_types: { name: string } | null;
  profiles: { username: string } | null;
}

interface Props {
  profiles: Profile[];
  paramSets: ParamSetRow[];
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

function PublishToggle({ paramSetId, published }: { paramSetId: string; published: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState(published);

  async function toggle() {
    const next = !state;
    setState(next);
    await fetch(`/api/admin/param-sets/${paramSetId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: next }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold border transition-colors cursor-pointer disabled:opacity-50 ${
        state
          ? "bg-emerald-900/50 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/70"
          : "bg-secondary border-border text-muted-foreground hover:bg-secondary/80"
      }`}
    >
      {state ? "published" : "draft"}
    </button>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function AdminDashboard({ profiles, paramSets }: Props) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col gap-10">
      {/* Users */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">
          Users <span className="text-muted-foreground font-normal text-sm">({profiles.length})</span>
        </h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Username</th>
                <th className="px-4 py-2.5 text-left font-medium">Role</th>
                <th className="px-4 py-2.5 text-left font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p, i) => (
                <tr key={p.id} className={`${i !== profiles.length - 1 ? "border-b border-border" : ""}`}>
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

      {/* Param sets */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">
          Param Sets <span className="text-muted-foreground font-normal text-sm">({paramSets.length})</span>
        </h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Name</th>
                <th className="px-4 py-2.5 text-left font-medium">Drone</th>
                <th className="px-4 py-2.5 text-left font-medium">By</th>
                <th className="px-4 py-2.5 text-left font-medium">Created</th>
                <th className="px-4 py-2.5 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {paramSets.map((ps, i) => (
                <tr key={ps.id} className={`${i !== paramSets.length - 1 ? "border-b border-border" : ""}`}>
                  <td className="px-4 py-2.5 font-medium text-foreground">{ps.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{ps.drone_types?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{ps.profiles?.username ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{formatDate(ps.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <PublishToggle paramSetId={ps.id} published={ps.published} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
