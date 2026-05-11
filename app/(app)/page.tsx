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

async function getProfile(): Promise<{ role: string | null; clientId: string | null }> {
  try {
    const supabase = await createSessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { role: null, clientId: null };
    const { data } = await supabase
      .from("profiles")
      .select("role, client_id")
      .eq("id", user.id)
      .single();
    return { role: data?.role ?? null, clientId: data?.client_id ?? null };
  } catch {
    return { role: null, clientId: null };
  }
}

async function getFamilies(role: string | null, clientId: string | null) {
  const supabase = await createSessionClient();

  // For client users, find which variants they own drones on, then derive
  // which families to show. Other roles see everything.
  let allowedVariantIds: Set<string> | null = null;
  if (role === "client" && clientId) {
    const { data: drones } = await supabase
      .from("drones")
      .select("variant_id")
      .eq("client_id", clientId);
    allowedVariantIds = new Set((drones ?? []).map((d) => d.variant_id));
    // No drones → no families.
    if (allowedVariantIds.size === 0) return [];
  }

  let familiesQ = supabase.from("families").select("id, slug, name, description").order("name");

  // Restrict families to those that own at least one allowed variant.
  if (allowedVariantIds) {
    const { data: variants } = await supabase
      .from("variants")
      .select("family_id")
      .in("id", [...allowedVariantIds]);
    const allowedFamilyIds = new Set((variants ?? []).map((v) => v.family_id).filter(Boolean) as string[]);
    if (allowedFamilyIds.size === 0) return [];
    familiesQ = familiesQ.in("id", [...allowedFamilyIds]);
  }

  const { data: families } = await familiesQ;
  if (!families?.length) return [];

  const counts = await Promise.all(
    families.map(async (f) => {
      let q = supabase
        .from("variants")
        .select("id", { count: "exact", head: true })
        .eq("family_id", f.id);
      if (allowedVariantIds) q = q.in("id", [...allowedVariantIds]);
      const { count } = await q;
      return { ...f, variant_count: count ?? 0 };
    })
  );

  return counts;
}

export default async function CatalogPage() {
  const profile = await getProfile();
  const families = await getFamilies(profile.role, profile.clientId);
  const isAdmin = profile.role === "admin";
  const canUpload = profile.role === "admin" || profile.role === "contributor" || profile.role === "client";

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
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
          >
            <Columns2 className="h-3.5 w-3.5" />
            Compare versions
          </Link>
          <Link
            href="/filter"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
          >
            <Filter className="h-3.5 w-3.5" />
            Filter tool
          </Link>
          {canUpload && (
            <Link
              href="/upload"
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
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
