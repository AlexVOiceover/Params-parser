"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Usb, Eye, Download, Upload, ArrowUpCircle } from "lucide-react";
import { useDroneParams } from "@/lib/drone-params-context";
import { useConnectedDroneMatch } from "@/lib/use-connected-drone-match";
import { writeParamFile } from "@/lib/param-engine";
import { CatalogUploadModal } from "@/components/catalog-upload-modal";
import Link from "next/link";

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/**
 * Shown in the catalog grid when a drone is connected AND matched to a catalog
 * entry. Replaces ConnectedDroneCard in that slot so the family card can render
 * without competing emerald highlights.
 */
export function DroneIdentityCard() {
  const router = useRouter();
  const { droneParams } = useDroneParams();
  const match = useConnectedDroneMatch();
  const [uploadOpen, setUploadOpen] = useState(false);

  if (!droneParams || match.status !== "matched" || !match.drone) return null;

  const { drone, versionStatus, droneVersion, catalogVersion } = match;
  const content = writeParamFile(droneParams);
  const suggestedName = `drone-${timestamp()}`;

  function handleSave() {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `drone-${timestamp()}.param`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Usb className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="font-semibold text-emerald-700 dark:text-emerald-300">
            Connected drone
          </span>
          <span className="ml-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 leading-none whitespace-nowrap">
            {droneParams.length} params
          </span>
        </div>

        {/* Identity */}
        <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs">
          <dt className="text-emerald-700/70 dark:text-emerald-300/70">Serial</dt>
          <dd className="font-mono text-emerald-800 dark:text-emerald-200">{drone.serial}</dd>
          {drone.client_name && (
            <>
              <dt className="text-emerald-700/70 dark:text-emerald-300/70">Client</dt>
              <dd className="text-emerald-800 dark:text-emerald-200">{drone.client_name}</dd>
            </>
          )}
          {drone.family_name && drone.variant_name && (
            <>
              <dt className="text-emerald-700/70 dark:text-emerald-300/70">Catalog</dt>
              <dd className="text-emerald-800 dark:text-emerald-200">
                <Link
                  href={drone.family_slug ? `/${drone.family_slug}/${drone.variant_id}` : "/"}
                  className="hover:underline"
                >
                  {drone.family_name} / {drone.variant_name}
                </Link>
              </dd>
            </>
          )}
        </dl>

        {/* Version status */}
        {versionStatus !== "unknown" && droneVersion !== null && (
          <div className={`text-xs rounded px-2 py-1 ${
            versionStatus === "update_available"
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : versionStatus === "drone_ahead"
              ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
              : "text-emerald-700/80 dark:text-emerald-300/80"
          }`}>
            {versionStatus === "up_to_date" && `v${droneVersion} — up to date`}
            {versionStatus === "update_available" && `Update available — catalog v${catalogVersion}, drone v${droneVersion}`}
            {versionStatus === "drone_ahead" && `Drone v${droneVersion} is ahead of catalog v${catalogVersion}`}
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 border-t border-emerald-500/30 flex items-center gap-1.5">
          <button
            onClick={() => router.push("/compare?v=__drone__")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-2 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </button>
          <button
            onClick={handleSave}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-2 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            Save
          </button>
          <button
            onClick={() => setUploadOpen(true)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-2 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
          {versionStatus === "update_available" && drone.variant_id && (
            <Link
              href={`/${drone.family_slug}/${drone.variant_id}`}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-amber-500 hover:bg-amber-600 px-2 py-1.5 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowUpCircle className="h-3.5 w-3.5" />
              Update
            </Link>
          )}
        </div>
      </div>

      {uploadOpen && (
        <CatalogUploadModal
          content={content}
          suggestedName={suggestedName}
          onClose={() => setUploadOpen(false)}
        />
      )}
    </>
  );
}
