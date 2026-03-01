import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { DroneType } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getDroneTypes(): Promise<(DroneType & { param_set_count: number })[]> {
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
        .eq("drone_type_id", dt.id)
        .eq("published", true);
      return { ...dt, param_set_count: count ?? 0 };
    })
  );

  return counts;
}

export default async function CatalogPage() {
  const droneTypes = await getDroneTypes();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <p className="text-muted-foreground mb-8">
        Browse community-verified param configurations by drone type. Download any published set
        directly into Mission Planner.
      </p>

      {droneTypes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No drone types found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {droneTypes.map((dt) => (
            <Link
              key={dt.id}
              href={`/catalog/${dt.slug}`}
              className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-5 hover:border-primary/50 hover:bg-card/80 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                  {dt.name}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
              </div>
              {dt.description && (
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {dt.description}
                </p>
              )}
              <div className="mt-auto pt-3 border-t border-border/50">
                <span className="text-xs text-muted-foreground">
                  {dt.param_set_count === 0
                    ? "No param sets yet"
                    : `${dt.param_set_count} param set${dt.param_set_count === 1 ? "" : "s"}`}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
