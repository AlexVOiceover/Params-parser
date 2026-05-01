import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient, createSessionClient } from "@/lib/supabase/server";
import { ParamVersionList } from "@/components/param-version-list";
import type { Family, Variant, ClientSet, ParamVersion } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getData(familySlug: string, variantId: string, clientSetId: string) {
  const supabase = createClient();

  const [{ data: family }, { data: variant }, { data: clientSet }, { data: versions }] = await Promise.all([
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
      .select("id, name, description, created_at, updated_at, created_by, variant_id")
      .eq("id", clientSetId)
      .maybeSingle(),
    supabase
      .from("param_versions")
      .select("id, client_set_id, version_label, storage_path, changelog, created_by, created_at, is_latest")
      .eq("client_set_id", clientSetId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    family: family as Family | null,
    variant: variant as Variant | null,
    clientSet: clientSet as ClientSet | null,
    versions: (versions as ParamVersion[]) ?? [],
  };
}

async function getIsAdmin(): Promise<boolean> {
  try {
    const supabase = await createSessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    return data?.role === "admin";
  } catch { return false; }
}

export default async function ClientSetPage({
  params,
}: {
  params: Promise<{ familySlug: string; variantId: string; clientSetId: string }>;
}) {
  const { familySlug, variantId, clientSetId } = await params;
  const isAdmin = await getIsAdmin();
  const { family, variant, clientSet, versions } = await getData(familySlug, variantId, clientSetId);

  if (!family || !variant || !clientSet) notFound();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6 flex-wrap">
        <Link href="/" className="hover:text-foreground transition-colors cursor-pointer">Catalog</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/${familySlug}`} className="hover:text-foreground transition-colors cursor-pointer">{family.name}</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/${familySlug}/${variantId}`} className="hover:text-foreground transition-colors cursor-pointer">{variant.name}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{clientSet.name}</span>
      </nav>

      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-1">{clientSet.name}</h1>
          {clientSet.description && (
            <p className="text-sm text-muted-foreground">{clientSet.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Versions{versions.length > 0 ? ` (${versions.length})` : ""}
        </h2>
      </div>

      <ParamVersionList
        versions={versions}
        familySlug={familySlug}
        familyId={family.id}
        variantId={variantId}
        clientSetId={clientSetId}
        isAdmin={isAdmin}
        familyName={family.name}
        variantName={variant.name}
        clientSetName={clientSet.name}
      />
    </div>
  );
}
