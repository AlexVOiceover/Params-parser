import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient, createSessionClient } from "@/lib/supabase/server";
import { ParamVersionList } from "@/components/param-version-list";
import type { DroneType, ParamSet, ParamVersion } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getData(droneSlug: string, paramSetId: string) {
  const supabase = createClient();

  const [{ data: droneType }, { data: paramSet }, { data: versions }] = await Promise.all([
    supabase
      .from("drone_types")
      .select("id, slug, name, description")
      .eq("slug", droneSlug)
      .single(),
    supabase
      .from("param_sets")
      .select("id, name, description, created_at, updated_at, created_by, drone_type_id")
      .eq("id", paramSetId)
      .maybeSingle(),
    supabase
      .from("param_versions")
      .select("id, param_set_id, version_label, storage_path, changelog, created_by, created_at, is_latest")
      .eq("param_set_id", paramSetId)
      .order("created_at", { ascending: false }),
  ]);

return {
    droneType: droneType as DroneType | null,
    paramSet: paramSet as ParamSet | null,
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

export default async function ParamSetPage({
  params,
}: {
  params: Promise<{ droneSlug: string; paramSetId: string }>;
}) {
  const { droneSlug, paramSetId } = await params;
  const isAdmin = await getIsAdmin();
  const { droneType, paramSet, versions } = await getData(droneSlug, paramSetId);

  if (!droneType || !paramSet) notFound();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6 flex-wrap">
        <Link href="/catalog" className="hover:text-foreground transition-colors cursor-pointer">Catalog</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/catalog/${droneSlug}`} className="hover:text-foreground transition-colors cursor-pointer">{droneType.name}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{paramSet.name}</span>
      </nav>

      {/* Param set header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-1">{paramSet.name}</h1>
          {paramSet.description && (
            <p className="text-sm text-muted-foreground">{paramSet.description}</p>
          )}
        </div>
      </div>

      {/* Versions section */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Versions{versions.length > 0 ? ` (${versions.length})` : ""}
        </h2>
      </div>

      {versions.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No versions uploaded yet.</p>
        </div>
      ) : (
        <ParamVersionList
          versions={versions}
          droneSlug={droneSlug}
          droneTypeId={(droneType as DroneType & { id: string }).id}
          paramSetId={paramSetId}
          isAdmin={isAdmin}
          droneName={droneType.name}
          paramSetName={paramSet.name}
        />
      )}
    </div>
  );
}
