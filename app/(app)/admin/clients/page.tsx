import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { ClientsTable, type ClientRow } from "@/components/clients-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clients — AIR6",
};

export default async function ClientsPage() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const [{ data: clients }, { data: drones }, { data: users }] = await Promise.all([
    admin.from("clients").select("id, name").order("name"),
    admin.from("drones").select("client_id"),
    admin.from("profiles").select("client_id"),
  ]);
  const count = (rows: { client_id: string | null }[] | null, id: string) => (rows ?? []).filter((r) => r.client_id === id).length;
  const rows: ClientRow[] = (clients ?? []).map((c) => ({ id: c.id, name: c.name, drones: count(drones, c.id), users: count(users, c.id) }));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-xl font-semibold text-foreground">Clients</h1>
      <p className="text-sm text-muted-foreground mt-0.5 mb-6">
        Companies that own drones. Their users only ever see their own drones. Assign a drone to a client from the drone&apos;s page.
      </p>
      <ClientsTable clients={rows} />
    </div>
  );
}
