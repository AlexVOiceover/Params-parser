import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { ClientsTable, type ClientWithDrones, type FamilyOption, type VariantOption } from "@/components/clients-table";

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
  const [{ data: clientsData }, { data: familiesData }, { data: variantsData }] = await Promise.all([
    admin.from("clients").select("id, name, drones(id, serial, variant_id, client_sets(id))").order("name"),
    admin.from("families").select("id, name, slug").order("name"),
    admin.from("variants").select("id, name, family_id").order("name"),
  ]);

  const families: FamilyOption[] = (familiesData ?? []).map((f) => ({ id: f.id, name: f.name, slug: (f as { slug?: string }).slug ?? "" }));
  const variants: VariantOption[] = (variantsData ?? []).map((v) => ({ id: v.id, name: v.name, family_id: v.family_id ?? "" }));

  const clients: ClientWithDrones[] = (clientsData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    drones: ((c.drones as unknown) as { id: string; serial: string; variant_id: string; client_sets: { id: string }[] }[] ?? [])
      .slice()
      .sort((a, b) => a.serial.localeCompare(b.serial))
      .map((d) => ({ ...d, client_set_id: d.client_sets?.[0]?.id ?? null })),
  }));

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
        <Link href="/" className="text-primary hover:underline cursor-pointer">Catalog</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">Clients</span>
      </nav>
      <h1 className="text-xl font-semibold text-foreground mb-1">Clients</h1>
      <p className="text-sm text-muted-foreground mt-2 mb-6">
        Companies that own drones in the catalog. To register a new drone, connect it via USB and use the Import button — the wizard will handle setup.
      </p>
      <ClientsTable clients={clients} families={families} variants={variants} />
    </div>
  );
}
