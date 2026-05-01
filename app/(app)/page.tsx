import type { Metadata } from "next";
import Link from "next/link";
import { Columns2, Filter, Upload } from "lucide-react";
import { createClient, createSessionClient } from "@/lib/supabase/server";
import { DroneTypeGrid } from "@/components/drone-type-grid";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Catalog — AIR6",
};

async function getDroneTypes() {
  const supabase = createClient();

  const { data: droneTypes } = await supabase
    .from("drone_types")
    .select("id, slug, name, description")
    .order("name");

  if (!droneTypes?.length) return [];

  const counts = await Promise.all(
    droneTypes.map(async (dt) => {
      const { count } = await supabase
        .from("param_sets")
        .select("id", { count: "exact", head: true })
        .eq("drone_type_id", dt.id);
      return { ...dt, param_set_count: count ?? 0 };
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
  const [droneTypes, role] = await Promise.all([getDroneTypes(), getRole()]);
  const isAdmin = role === "admin";
  const canUpload = role === "admin" || role === "contributor";

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-end justify-between gap-4 mb-6">
        <h1 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Drone types
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
      {droneTypes.length === 0 && !isAdmin ? (
        <p className="text-sm text-muted-foreground">No drone types found.</p>
      ) : (
        <DroneTypeGrid droneTypes={droneTypes} isAdmin={isAdmin} />
      )}
    </div>
  );
}
