import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { AdminDashboard } from "@/components/admin-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin — AIR6",
};

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
  const [{ data: profiles }, { data: authUsers }, { data: clients }] = await Promise.all([
    admin.from("profiles").select("id, username, role, client_id, created_at").order("created_at"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("clients").select("id, name").order("name"),
  ]);

  const emailById = Object.fromEntries((authUsers?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const profilesWithEmail = (profiles ?? []).map((p) => ({
    id: p.id,
    username: p.username,
    role: p.role,
    client_id: p.client_id ?? null,
    created_at: p.created_at,
    email: emailById[p.id] ?? "",
  }));

  return (
    <AdminDashboard
      profiles={profilesWithEmail}
      clients={clients ?? []}
      currentUserId={user.id}
    />
  );
}
