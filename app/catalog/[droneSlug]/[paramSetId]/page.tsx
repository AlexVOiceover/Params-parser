import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { DroneType, ParamSet, ParamVersion } from "@/lib/types";

export const revalidate = 60;

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
      .select("id, name, description, firmware_id, created_at, updated_at, published, created_by, drone_type_id, firmwares(id, version, release_date, drone_type_id)")
      .eq("id", paramSetId)
      .eq("published", true)
      .single(),
    supabase
      .from("param_versions")
      .select("id, param_set_id, version_label, storage_path, changelog, created_by, created_at, is_latest")
      .eq("param_set_id", paramSetId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    droneType: droneType as DroneType | null,
    paramSet: paramSet as (ParamSet & { firmwares?: { version: string } | null }) | null,
    versions: (versions as ParamVersion[]) ?? [],
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function storageUrl(storagePath: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/param-files/${storagePath}`;
}

export default async function ParamSetPage({
  params,
}: {
  params: Promise<{ droneSlug: string; paramSetId: string }>;
}) {
  const { droneSlug, paramSetId } = await params;
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

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl font-semibold text-foreground mb-1">{paramSet.name}</h1>
          {paramSet.description && (
            <p className="text-sm text-muted-foreground">{paramSet.description}</p>
          )}
        </div>
        {paramSet.firmwares && (
          <span className="shrink-0 rounded-full bg-primary/15 border border-primary/30 px-3 py-1 text-xs font-mono text-primary mt-0.5">
            ArduPilot v{paramSet.firmwares.version}
          </span>
        )}
      </div>

      {/* Versions */}
      {versions.length === 0 ? (
        <div className="rounded-lg border border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">No versions uploaded yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {versions.map((v) => (
            <div
              key={v.id}
              className="rounded-lg border border-border bg-card px-5 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-foreground">
                    {v.version_label}
                  </span>
                  {v.is_latest && (
                    <span className="rounded-full bg-emerald-900/50 border border-emerald-700/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                      latest
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{formatDate(v.created_at)}</span>
                </div>
                <a
                  href={storageUrl(v.storage_path)}
                  download
                  className="flex items-center gap-1.5 rounded-md bg-primary/15 border border-primary/30 hover:bg-primary/25 px-3 py-1.5 text-xs font-medium text-primary transition-colors cursor-pointer shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download .param
                </a>
              </div>
              {v.changelog && (
                <p className="mt-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap border-t border-border/50 pt-3">
                  {v.changelog}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
