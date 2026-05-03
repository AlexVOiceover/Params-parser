import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { ClientsTable, type ClientWithDrones } from "@/components/clients-table";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clients — AIR6",
};

export default async function ClientsPage() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const { data: clientsData } = await admin
    .from("clients")
    .select("id, name, drones(id, serial)")
    .order("name");

  const clients: ClientWithDrones[] = (clientsData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    drones: ((c.drones as unknown) as { id: string; serial: string }[] ?? [])
      .slice()
      .sort((a, b) => a.serial.localeCompare(b.serial)),
  }));

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors cursor-pointer">Catalog</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Clients</span>
      </nav>
      <h1 className="text-xl font-semibold text-foreground mb-1">Clients</h1>
      <p className="text-sm text-muted-foreground mt-2 mb-6">
        Companies that own one or more drones in the catalog. Click a row to expand its drones.
      </p>
      <ClientsTable clients={clients} />
    </div>
  );
}
