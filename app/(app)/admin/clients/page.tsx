import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { ClientList } from "@/components/client-list";

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
  const { data: clients } = await admin
    .from("clients")
    .select("id, name")
    .order("name");

  if (!clients?.length) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-10">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
          <Link href="/" className="hover:text-foreground transition-colors cursor-pointer">Catalog</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">Clients</span>
        </nav>
        <h1 className="text-xl font-semibold text-foreground mb-1">Clients</h1>
        <p className="text-sm text-muted-foreground mt-2 mb-6">
          Companies that own one or more drones in the catalog. Add clients here, then add their drones (serials).
        </p>
        <ClientList clients={[]} droneCounts={{}} />
      </div>
    );
  }

  // Drone counts per client
  const counts: Record<string, number> = {};
  await Promise.all(
    clients.map(async (c) => {
      const { count } = await admin
        .from("drones")
        .select("id", { count: "exact", head: true })
        .eq("client_id", c.id);
      counts[c.id] = count ?? 0;
    })
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors cursor-pointer">Catalog</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Clients</span>
      </nav>
      <h1 className="text-xl font-semibold text-foreground mb-1">Clients</h1>
      <p className="text-sm text-muted-foreground mt-2 mb-6">
        Companies that own one or more drones in the catalog. Add clients here, then add their drones (serials).
      </p>
      <ClientList clients={clients} droneCounts={counts} />
    </div>
  );
}
