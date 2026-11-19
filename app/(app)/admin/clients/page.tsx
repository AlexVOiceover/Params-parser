import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { StaffAndClients } from "@/components/staff-and-clients";
import type { ClientRow } from "@/components/client-dialogs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff & clients — AIR6",
};

interface DroneRef { id: string; client_id: string | null }
interface HistoryRef { client_id: string | null; drone_id: string | null }

export default async function StaffAndClientsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const [{ data: clients }, { data: droneData }, { data: profiles }, { data: authUsers }, { data: historyData }] = await Promise.all([
    admin.from("clients").select("id, name").order("name"),
    admin.from("drones").select("id, client_id"),
    admin.from("profiles").select("id, username, role, client_id, created_at").order("created_at"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("client_sets").select("client_id, drone_id").not("client_id", "is", null),
  ]);
  const drones = (droneData ?? []) as DroneRef[];
  const histories = (historyData ?? []) as HistoryRef[];
  const people = profiles ?? [];

  const rows: ClientRow[] = (clients ?? []).map((c) => {
    const own = new Set(drones.filter((d) => d.client_id === c.id).map((d) => d.id));
    return {
      id: c.id,
      name: c.name,
      drones: own.size,
      users: people.filter((p) => p.client_id === c.id).length,
      // The delete route refuses while any history names the client. Those of its own drones go
      // away with the drones, so only the others need their own explanation.
      histories: histories.filter((h) => h.client_id === c.id && !(h.drone_id && own.has(h.drone_id))).length,
    };
  });

  const emailById = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  return (
    <StaffAndClients
      initialTab={tab === "clients" ? "clients" : "staff"}
      profiles={people.map((p) => ({
        id: p.id,
        username: p.username,
        role: p.role,
        client_id: p.client_id ?? null,
        created_at: p.created_at,
        email: emailById.get(p.id) ?? "",
      }))}
      clients={rows}
      currentUserId={user.id}
    />
  );
}
