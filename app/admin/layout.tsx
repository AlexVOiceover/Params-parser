import Link from "next/link";
import { Settings, ChevronRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — AIR6",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border bg-toolbar px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Settings className="h-4 w-4 text-primary" />
          Admin
        </div>
        <div className="flex-1" />
        <Link
          href="/catalog"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          Catalog
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          Filter Tool
        </Link>
      </header>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
