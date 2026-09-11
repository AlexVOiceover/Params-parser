import type { Metadata } from "next";
import Link from "next/link";
import { Columns2, Filter, Upload } from "lucide-react";
import { createSessionClient } from "@/lib/supabase/server";
import { FamilyGrid } from "@/components/family-grid";
import { DroneStatusBanner } from "@/components/drone-status-banner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catalog — AIR6",
};

/**
 * Catalog data in as few round-trips as possible.
 *
 * Each Supabase round-trip costs ~150-200ms, and this page previously chained
 * them: auth, then profile, then drones, then variants, then families, then a
 * separate count query per family. Families and variants are small tables, so
 * fetching both whole and counting in memory is far cheaper than N count
 * queries, and the independent ones now run concurrently.
 */
async function getCatalog() {
  const supabase = await createSessionClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Profile, families and variants are independent — fetch together.
  const [profileRes, familiesRes, variantsRes] = await Promise.all([
    user
      ? supabase.from("profiles").select("role, client_id").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase.from("families").select("id, slug, name, description").order("name"),
    supabase.from("variants").select("id, family_id"),
  ]);

  const role = (profileRes.data?.role as string | null) ?? null;
  const clientId = (profileRes.data?.client_id as string | null) ?? null;
  const families = familiesRes.data ?? [];
  const variants = variantsRes.data ?? [];

  // Client users only see families they own a drone on.
  let allowedVariantIds: Set<string> | null = null;
  if (role === "client" && clientId) {
    const { data: drones } = await supabase
      .from("drones")
      .select("variant_id")
      .eq("client_id", clientId);
    allowedVariantIds = new Set((drones ?? []).map((d) => d.variant_id));
    if (allowedVariantIds.size === 0) return { role, families: [] };
  }

  const countByFamily = new Map<string, number>();
  for (const v of variants) {
    if (!v.family_id) continue;
    if (allowedVariantIds && !allowedVariantIds.has(v.id)) continue;
    countByFamily.set(v.family_id, (countByFamily.get(v.family_id) ?? 0) + 1);
  }

  const visible = families
    .filter((f) => !allowedVariantIds || (countByFamily.get(f.id) ?? 0) > 0)
    .map((f) => ({ ...f, variant_count: countByFamily.get(f.id) ?? 0 }));

  return { role, families: visible };
}

export default async function CatalogPage() {
  const { role, families } = await getCatalog();
  const isAdmin = role === "admin";
  const canUpload = role === "admin" || role === "contributor";

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <DroneStatusBanner />
      <div className="flex items-end justify-between gap-4 mb-6">
        <h1 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Families
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/compare"
            title="Compare versions"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
          >
            <Columns2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Compare versions</span>
          </Link>
          <Link
            href="/filter"
            title="Filter tool"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filter tool</span>
          </Link>
          {canUpload && (
            <Link
              href="/upload"
              title="Upload"
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Upload</span>
            </Link>
          )}
        </div>
      </div>
      {families.length === 0 && !isAdmin ? (
        <p className="text-sm text-muted-foreground">No families found.</p>
      ) : (
        <FamilyGrid families={families} isAdmin={isAdmin} />
      )}
    </div>
  );
}
