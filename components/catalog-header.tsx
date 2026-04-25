"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Filter, Library, Upload, Settings, Columns2, Usb } from "lucide-react";
import { useDroneParams, DRONE_VERSION_ID } from "@/lib/drone-params-context";
import { ConnectDroneDialog } from "@/components/connect-drone-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { useSerialMode } from "@/lib/use-serial-mode";
import type { Param } from "@/lib/types";

interface Props {
  canUpload: boolean;
  isAdmin: boolean;
}

export function CatalogHeader({ canUpload, isAdmin }: Props) {
  const { droneParams, setDroneParams, clearDroneParams } = useDroneParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showDroneDialog, setShowDroneDialog] = useState(false);
  const serialMode = useSerialMode();
  const hasWebSerial = serialMode !== "unsupported";

  const handleParamsLoaded = useCallback(
    (params: Param[]) => {
      setDroneParams(params.map((p) => ({ name: p.name, value: p.value })));
    },
    [setDroneParams]
  );

  const handleForget = useCallback(() => {
    clearDroneParams();
    // If currently viewing a compare page that depends on drone params, bounce back.
    const viewing = searchParams.getAll("v");
    if (pathname === "/catalog/compare" && viewing.includes(DRONE_VERSION_ID)) {
      router.push("/catalog");
    }
  }, [clearDroneParams, pathname, searchParams, router]);

  const hasParams = droneParams !== null && droneParams.length > 0;

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border bg-toolbar px-4 py-2.5 shrink-0">
        <Link
          href="/catalog"
          className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
        >
          <Library className="h-4 w-4 text-primary" />
          Param Catalog
        </Link>
        <div className="flex-1" />

        {hasWebSerial && (
          <button
            onClick={() => setShowDroneDialog(true)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              hasParams
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                : "border-border text-foreground hover:bg-secondary"
            }`}
          >
            <Usb className="h-3.5 w-3.5" />
            {hasParams ? `Drone (${droneParams.length} params)` : "Import from drone"}
          </button>
        )}

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
        <div className="w-px h-4 bg-border shrink-0 ml-1" />
        <ThemeToggle />
      </header>

      {showDroneDialog && (
        <ConnectDroneDialog
          onParamsLoaded={handleParamsLoaded}
          onClose={() => setShowDroneDialog(false)}
          onForget={handleForget}
        />
      )}
    </>
  );
}
