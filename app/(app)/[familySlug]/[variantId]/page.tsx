import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient, createSessionClient } from "@/lib/supabase/server";
import { ClientSetList } from "@/components/client-set-list";
import type { Family, Variant, ClientSet } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getData(familySlug: string, variantId: string) {
  const supabase = createClient();

  const [{ data: family }, { data: variant }, { data: clientSets }] = await Promise.all([
    supabase
      .from("families")
      .select("id, slug, name, description")
      .eq("slug", familySlug)
      .single(),
    supabase
      .from("variants")
      .select("id, name, description, created_at, updated_at, created_by, family_id")
      .eq("id", variantId)
      .maybeSingle(),
    supabase
      .from("client_sets")
      .select("id, name, description, created_at, updated_at, created_by, variant_id, param_versions(version_label, created_at)")
      .eq("variant_id", variantId)
      .order("updated_at", { ascending: false }),
  ]);

  return {
    family: family as Family | null,
    variant: variant as Variant | null,
    clientSets: (clientSets as unknown as (ClientSet & { param_versions: { version_label: string; created_at: string }[] })[]) ?? [],
  };
}

async function getRole(): Promise<string | null> {
  try {
    const supabase = await createSessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    return data?.role ?? null;
  } catch { return null; }
}

export default async function VariantPage({
  params,
}: {
  params: Promise<{ familySlug: string; variantId: string }>;
}) {
  const { familySlug, variantId } = await params;
  const [role, data] = await Promise.all([getRole(), getData(familySlug, variantId)]);
  const isAdmin = role === "admin";
  const canCreate = role === "admin" || role === "contributor";
  const { family, variant, clientSets } = data;

  if (!family || !variant) notFound();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6 flex-wrap">
        <Link href="/" className="hover:text-foreground transition-colors cursor-pointer">Catalog</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/${familySlug}`} className="hover:text-foreground transition-colors cursor-pointer">{family.name}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{variant.name}</span>
      </nav>

      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-1">{variant.name}</h1>
          {variant.description && (
            <p className="text-sm text-muted-foreground">{variant.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Client sets{clientSets.length > 0 ? ` (${clientSets.length})` : ""}
        </h2>
      </div>

      {clientSets.length === 0 && !canCreate ? (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No client sets for this variant yet.</p>
        </div>
      ) : (
        <ClientSetList
          familySlug={familySlug}
          variantId={variantId}
          clientSets={clientSets}
          isAdmin={isAdmin}
          canCreate={canCreate}
        />
      )}
    </div>
  );
}
