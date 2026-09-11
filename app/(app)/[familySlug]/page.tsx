import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createSessionClient } from "@/lib/supabase/server";
import { VariantList } from "@/components/variant-list";
import type { Family, Variant } from "@/lib/types";

export const dynamic = "force-dynamic";

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

/**
 * getUser() is a ~50ms network call and is not cached, so the family lookup and
 * the profile lookup share one client and one auth check rather than each
 * paying for their own.
 */
async function getFamilyAndProfile(slug: string): Promise<{
  family: Family | null;
  role: string | null;
  clientId: string | null;
}> {
  try {
    const supabase = await createSessionClient();
    const { data: { user } } = await supabase.auth.getUser();

    const [familyRes, profileRes] = await Promise.all([
      supabase.from("families").select("id, slug, name, description").eq("slug", slug).single(),
      user
        ? supabase.from("profiles").select("role, client_id").eq("id", user.id).single()
        : Promise.resolve({ data: null }),
    ]);

    return {
      family: (familyRes.data as Family | null) ?? null,
      role: (profileRes.data?.role as string | null) ?? null,
      clientId: (profileRes.data?.client_id as string | null) ?? null,
    };
  } catch {
    return { family: null, role: null, clientId: null };
  }
}

export default async function FamilySlugPage({
  params,
}: {
  params: Promise<{ familySlug: string }>;
}) {
  const { familySlug } = await params;
  const { family, role, clientId } = await getFamilyAndProfile(familySlug);
  if (!family) notFound();

  const isAdmin = role === "admin";
  const variants = await getVariants(family.id, role, clientId);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
        <Link href="/" className="text-primary hover:underline cursor-pointer">Catalog</Link>
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
