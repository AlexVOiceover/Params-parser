import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase/server";
import { DroneParamsProvider } from "@/lib/drone-params-context";
import { CatalogHeader } from "@/components/catalog-header";

export const metadata: Metadata = {
  title: "Param Catalog — AIR6",
};

export default async function CatalogLayout({ children }: { children: React.ReactNode }) {
  let role: string | null = null;
  try {
    const supabase = await createSessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      role = profile?.role ?? null;
    }
  } catch {
    // unauthenticated or error — show no privileged links
  }

  const canUpload = role === "contributor" || role === "admin";
  const isAdmin = role === "admin";

  return (
    <DroneParamsProvider>
      <div className="flex h-screen flex-col overflow-hidden">
        <CatalogHeader canUpload={canUpload} isAdmin={isAdmin} />
        <main className="flex-1 overflow-y-auto min-h-0">
          {children}
        </main>
      </div>
    </DroneParamsProvider>
  );
}
