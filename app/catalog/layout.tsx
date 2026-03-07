import Link from "next/link";
import { Filter, Library, Upload, Settings, Columns2 } from "lucide-react";
import type { Metadata } from "next";
import { createSessionClient } from "@/lib/supabase/server";

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
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border bg-toolbar px-4 py-2.5 shrink-0">
        <Link
          href="/catalog"
          className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
        >
          <Library className="h-4 w-4 text-primary" />
          Param Catalog
        </Link>
        <div className="flex-1" />
        <Link
          href="/catalog/compare"
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
        >
          <Columns2 className="h-3.5 w-3.5" />
          Compare
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
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors cursor-pointer whitespace-nowrap"
          >
            <Settings className="h-3.5 w-3.5" />
            Admin
          </Link>
        )}
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
        >
          <Filter className="h-3.5 w-3.5" />
          Filter Tool
        </Link>
      </header>
      <main className="flex-1 overflow-y-auto min-h-0">
        {children}
      </main>
    </div>
  );
}
