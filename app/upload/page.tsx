import { redirect } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { UploadForm } from "@/components/upload-form";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const supabase = await createSessionClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["contributor", "admin"].includes(profile.role)) {
    redirect("/");
  }

  const admin = createAdminClient();
  const [{ data: droneTypes }, { data: paramSets }] = await Promise.all([
    admin.from("drone_types").select("id, name").order("name"),
    admin.from("param_sets").select("id, name, drone_type_id").order("name"),
  ]);

  return (
    <UploadForm
      droneTypes={droneTypes ?? []}
      paramSets={paramSets ?? []}
    />
  );
}
