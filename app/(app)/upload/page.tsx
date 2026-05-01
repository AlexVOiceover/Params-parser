import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSessionClient, createAdminClient } from "@/lib/supabase/server";
import { UploadForm } from "@/components/upload-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Upload — AIR6",
};

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
  const [{ data: families }, { data: variants }, { data: clientSets }] = await Promise.all([
    admin.from("families").select("id, name").order("name"),
    admin.from("variants").select("id, name, family_id").order("name"),
    admin.from("client_sets").select("id, name, variant_id").order("name"),
  ]);

  return (
    <UploadForm
      families={families ?? []}
      variants={variants ?? []}
      clientSets={clientSets ?? []}
    />
  );
}
