import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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
    .select("id, name, description, firmware_id, created_at, updated_at, published, created_by, drone_type_id, firmwares(id, version, release_date, drone_type_id)")
    .eq("drone_type_id", droneTypeId)
    .eq("published", true)
    .order("updated_at", { ascending: false });
  return (data as unknown as ParamSet[]) ?? [];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default async function DroneSlugPage({
  params,
}: {
  params: Promise<{ droneSlug: string }>;
}) {
  const { droneSlug } = await params;
  const droneType = await getDroneType(droneSlug);
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
        <p className="text-sm text-muted-foreground mb-8">{droneType.description}</p>
      )}

      {paramSets.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No published param sets for this drone type yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {paramSets.map((ps) => (
            <Link
              key={ps.id}
              href={`/catalog/${droneSlug}/${ps.id}`}
              className="group flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4 hover:border-primary/50 transition-colors cursor-pointer"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                  {ps.name}
                </span>
                {ps.description && (
                  <p className="text-xs text-muted-foreground line-clamp-1">{ps.description}</p>
                )}
                <span className="text-xs text-muted-foreground mt-1">
                  Updated {formatDate(ps.updated_at)}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0 mt-0.5">
                {ps.firmwares && (
                  <span className="rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-xs font-mono text-primary">
                    v{ps.firmwares.version}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
