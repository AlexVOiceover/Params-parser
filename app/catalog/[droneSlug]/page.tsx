import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient, createSessionClient } from "@/lib/supabase/server";
import { ParamSetList } from "@/components/param-set-list";
import type { DroneType, ParamSet } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getDroneType(slug: string): Promise<DroneType | null> {
  const { data } = await createClient()
    .from("drone_types")
    .select("id, slug, name, description")
    .eq("slug", slug)
    .single();
  return data ?? null;
}

async function getParamSets(droneTypeId: string): Promise<ParamSet[]> {
  const { data } = await createClient()
    .from("param_sets")
    .select("id, name, description, created_at, updated_at, created_by, drone_type_id, param_versions(version_label, created_at)")
    .eq("drone_type_id", droneTypeId)
    .order("updated_at", { ascending: false });
  return (data as unknown as ParamSet[]) ?? [];
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

export default async function DroneSlugPage({
  params,
}: {
  params: Promise<{ droneSlug: string }>;
}) {
  const { droneSlug } = await params;
  const [droneType, isAdmin] = await Promise.all([getDroneType(droneSlug), getIsAdmin()]);
  if (!droneType) notFound();

  const paramSets = await getParamSets(droneType.id);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6">
        <Link href="/catalog" className="hover:text-foreground transition-colors cursor-pointer">Catalog</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{droneType.name}</span>
      </nav>

      <h1 className="text-xl font-semibold text-foreground mb-1">{droneType.name}</h1>
      {droneType.description && (
        <p className="text-sm text-muted-foreground mb-2">{droneType.description}</p>
      )}

      <div className="flex items-center justify-between mb-3 mt-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Param sets{paramSets.length > 0 ? ` (${paramSets.length})` : ""}
        </h2>
      </div>

      {paramSets.length === 0 && !isAdmin ? (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No param sets for this drone type yet.</p>
        </div>
      ) : (
        <ParamSetList droneSlug={droneSlug} droneTypeId={droneType.id} paramSets={paramSets} isAdmin={isAdmin} />
      )}
    </div>
  );
}
