import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { ReviewQueue } from "@/components/review-queue";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  const { data: versions } = await supabase
    .from("param_versions")
    .select(`
      id,
      version_label,
      created_at,
      client_set_id,
      client_sets (
        client_name,
        serial,
        client_id,
        drone_id,
        clients ( name ),
        drones ( serial )
      )
    `)
    .eq("needs_review", true)
    .order("created_at", { ascending: false });

  const rows = (versions ?? []).map((v) => {
    const csRaw = v.client_sets as unknown as {
      client_name: string;
      serial: string;
      client_id: string | null;
      drone_id: string | null;
      clients: { name: string } | null;
      drones: { serial: string } | null;
    } | null;
    const cs = csRaw;
    return {
      id: v.id,
      versionLabel: v.version_label,
      createdAt: v.created_at,
      clientSetId: v.client_set_id,
      clientName: cs?.clients?.name ?? cs?.client_name ?? "—",
      droneSerial: cs?.drones?.serial ?? cs?.serial ?? "—",
    };
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-lg font-bold text-foreground mb-1">Review queue</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Captured versions from drones ahead of the catalog. Accept to publish, discard to remove.
      </p>
      <ReviewQueue rows={rows} />
    </div>
  );
}
