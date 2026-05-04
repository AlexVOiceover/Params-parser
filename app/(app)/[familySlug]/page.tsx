import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createSessionClient } from "@/lib/supabase/server";
import { VariantList } from "@/components/variant-list";
import type { Family, Variant } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getFamily(slug: string): Promise<Family | null> {
  const supabase = await createSessionClient();
  const { data } = await supabase
    .from("families")
    .select("id, slug, name, description")
    .eq("slug", slug)
    .single();
  return data ?? null;
}

async function getVariants(familyId: string, role: string | null, clientId: string | null): Promise<Variant[]> {
  const supabase = await createSessionClient();

  // Client users only see variants where they own at least one drone.
  let allowedVariantIds: string[] | null = null;
  if (role === "client" && clientId) {
    const { data: drones } = await supabase
      .from("drones")
      .select("variant_id")
      .eq("client_id", clientId);
    allowedVariantIds = (drones ?? []).map((d) => d.variant_id);
    if (allowedVariantIds.length === 0) return [];
  }

  let q = supabase
    .from("variants")
    .select("id, name, description, created_at, updated_at, created_by, family_id")
    .eq("family_id", familyId)
    .order("updated_at", { ascending: false });
  if (allowedVariantIds) q = q.in("id", allowedVariantIds);
  const { data } = await q;
  return (data as unknown as Variant[]) ?? [];
}

async function getProfile(): Promise<{ role: string | null; clientId: string | null }> {
  try {
    const supabase = await createSessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { role: null, clientId: null };
    const { data } = await supabase.from("profiles").select("role, client_id").eq("id", user.id).single();
    return { role: data?.role ?? null, clientId: data?.client_id ?? null };
  } catch {
    return { role: null, clientId: null };
  }
}

export default async function FamilySlugPage({
  params,
}: {
  params: Promise<{ familySlug: string }>;
}) {
  const { familySlug } = await params;
  const [family, profile] = await Promise.all([getFamily(familySlug), getProfile()]);
  if (!family) notFound();

  const isAdmin = profile.role === "admin";
  const variants = await getVariants(family.id, profile.role, profile.clientId);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground transition-colors cursor-pointer">Catalog</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{family.name}</span>
      </nav>

      <h1 className="text-xl font-semibold text-foreground mb-1">{family.name}</h1>
      {family.description && (
        <p className="text-sm text-muted-foreground mb-2">{family.description}</p>
      )}

      <div className="flex items-center justify-between mb-3 mt-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Variants{variants.length > 0 ? ` (${variants.length})` : ""}
        </h2>
      </div>

      {variants.length === 0 && !isAdmin ? (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No variants for this family yet.</p>
        </div>
      ) : (
        <VariantList familySlug={familySlug} familyId={family.id} variants={variants} isAdmin={isAdmin} />
      )}
    </div>
  );
}
