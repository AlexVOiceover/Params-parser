import type { Metadata } from "next";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { ClientDetail } from "@/components/client-detail";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client — AIR6",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;

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

  const [{ data: client }, { data: drones }] = await Promise.all([
    admin.from("clients").select("id, name").eq("id", clientId).maybeSingle(),
    admin.from("drones").select("id, serial").eq("client_id", clientId).order("serial"),
  ]);

  if (!client) notFound();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6 flex-wrap">
        <Link href="/" className="hover:text-foreground transition-colors cursor-pointer">Catalog</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/admin/clients" className="hover:text-foreground transition-colors cursor-pointer">Clients</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{client.name}</span>
      </nav>

      <ClientDetail client={client} drones={drones ?? []} />
    </div>
  );
}
