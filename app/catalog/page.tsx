import { createClient, createSessionClient } from "@/lib/supabase/server";
import { DroneTypeGrid } from "@/components/drone-type-grid";

export const dynamic = "force-dynamic";

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

async function getIsAdmin(): Promise<boolean> {
  try {
    const supabase = await createSessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    return data?.role === "admin";
  } catch {
    return false;
  }
}

export default async function CatalogPage() {
  const [droneTypes, isAdmin] = await Promise.all([getDroneTypes(), getIsAdmin()]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <p className="text-muted-foreground mb-8">
        Browse community-verified param configurations by drone type. Download any set
        directly into Mission Planner.
      </p>

      {droneTypes.length === 0 && !isAdmin ? (
        <p className="text-sm text-muted-foreground">No drone types found.</p>
      ) : (
        <DroneTypeGrid droneTypes={droneTypes} isAdmin={isAdmin} />
      )}
    </div>
  );
}
