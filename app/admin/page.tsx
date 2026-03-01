import { redirect } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { AdminDashboard } from "@/components/admin-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, role, created_at")
    .order("created_at");

  return <AdminDashboard profiles={profiles ?? []} />;
}
