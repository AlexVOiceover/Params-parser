import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { ClientsTable, type ClientRow } from "@/components/clients-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clients — AIR6",
};

interface DroneRef { id: string; client_id: string | null }
interface UserRef { client_id: string | null }
interface HistoryRef { client_id: string | null; drone_id: string | null }

export default async function ClientsPage() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const [{ data: clients }, { data: droneData }, { data: userData }, { data: historyData }] = await Promise.all([
    admin.from("clients").select("id, name").order("name"),
    admin.from("drones").select("id, client_id"),
    admin.from("profiles").select("client_id"),
    admin.from("client_sets").select("client_id, drone_id").not("client_id", "is", null),
  ]);
  const drones = (droneData ?? []) as DroneRef[];
  const users = (userData ?? []) as UserRef[];
  const histories = (historyData ?? []) as HistoryRef[];

  const rows: ClientRow[] = (clients ?? []).map((c) => {
    const own = new Set(drones.filter((d) => d.client_id === c.id).map((d) => d.id));
    return {
      id: c.id,
      name: c.name,
      drones: own.size,
      users: users.filter((u) => u.client_id === c.id).length,
      // The delete route refuses while any history names the client. Those of its own drones go
      // away with the drones, so only the others need their own explanation.
      histories: histories.filter((h) => h.client_id === c.id && !(h.drone_id && own.has(h.drone_id))).length,
    };
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <ClientsTable clients={rows} />
    </div>
  );
}
