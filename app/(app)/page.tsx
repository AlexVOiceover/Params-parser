import type { Metadata } from "next";
import Link from "next/link";
import { Columns2, Filter, Upload } from "lucide-react";
import { createClient, createSessionClient } from "@/lib/supabase/server";
import { FamilyGrid } from "@/components/family-grid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catalog — AIR6",
};

async function getFamilies() {
  const supabase = createClient();

  const { data: families } = await supabase
    .from("families")
    .select("id, slug, name, description")
    .order("name");

  if (!families?.length) return [];

  const counts = await Promise.all(
    families.map(async (f) => {
      const { count } = await supabase
        .from("variants")
        .select("id", { count: "exact", head: true })
        .eq("family_id", f.id);
      return { ...f, variant_count: count ?? 0 };
    })
  );

  return counts;
}

async function getRole(): Promise<string | null> {
  try {
    const supabase = await createSessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    return data?.role ?? null;
  } catch {
    return null;
  }
}

export default async function CatalogPage() {
  const [families, role] = await Promise.all([getFamilies(), getRole()]);
  const isAdmin = role === "admin";
  const canUpload = role === "admin" || role === "contributor";

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
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
