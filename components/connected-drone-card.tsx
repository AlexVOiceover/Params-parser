"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Usb, Unplug, Eye, Download, Upload } from "lucide-react";
import { useDroneParams } from "@/lib/drone-params-context";
import { useSerialMode } from "@/lib/use-serial-mode";
import { writeParamFile } from "@/lib/param-engine";
import { CatalogUploadModal } from "@/components/catalog-upload-modal";

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export function ConnectedDroneCard() {
  const router = useRouter();
  const { droneParams, openImportDialog } = useDroneParams();
  const serialMode = useSerialMode();
  const hasWebSerial = serialMode !== "unsupported";
  const hasParams = droneParams !== null && droneParams.length > 0;
  const [uploadOpen, setUploadOpen] = useState(false);

  function handleSave() {
    if (!droneParams) return;
    const content = writeParamFile(droneParams);
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

  if (hasParams) {
    const content = writeParamFile(droneParams);
    const suggestedName = `drone-${timestamp()}`;

    return (
      <>
        <div className="group/card flex flex-col gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-5">
          <div className="flex items-center gap-2">
            <Usb className="h-4 w-4 text-emerald-500 shrink-0" />
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
              Connected drone
            </span>
            <span className="ml-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 leading-none">
              {droneParams.length} params
            </span>
          </div>
          <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 leading-relaxed">
            Live params read from USB.
          </p>
          <div className="mt-auto pt-3 border-t border-emerald-500/30 flex items-center gap-1.5">
            <button
              onClick={() => router.push("/compare?v=__drone__")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-2 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
              title="View drone params in compare"
            >
              <Eye className="h-3.5 w-3.5" />
              View
            </button>
            <button
              onClick={handleSave}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-2 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
              title="Download drone params as .param file"
            >
              <Download className="h-3.5 w-3.5" />
              Save
            </button>
            <button
              onClick={() => setUploadOpen(true)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-2 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
              title="Publish drone params to the catalog"
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </button>
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

  if (!hasWebSerial) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-rose-500/40 bg-rose-500/5 p-5 cursor-default">
        <div className="flex items-center gap-2">
          <Unplug className="h-4 w-4 text-rose-500 shrink-0" />
          <span className="font-semibold text-rose-700 dark:text-rose-300">
            No drone connected
          </span>
        </div>
        <p className="text-xs text-rose-700/80 dark:text-rose-300/80 leading-relaxed">
          USB import is not available in this browser.
        </p>
        <div className="mt-auto pt-3 border-t border-rose-500/30">
          <span className="text-xs text-rose-700/70 dark:text-rose-300/70">
            Not available
          </span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={openImportDialog}
      className="group/card flex flex-col gap-2 rounded-lg border border-rose-500/40 bg-rose-500/5 p-5 text-left hover:border-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-2">
        <Unplug className="h-4 w-4 text-rose-500 shrink-0" />
        <span className="font-semibold text-rose-700 dark:text-rose-300">
          No drone connected
        </span>
      </div>
      <p className="text-xs text-rose-700/80 dark:text-rose-300/80 leading-relaxed">
        Click to import live params via USB.
      </p>
      <div className="mt-auto pt-3 border-t border-rose-500/30">
        <span className="text-xs font-medium text-rose-700 dark:text-rose-300">
          Import from drone
        </span>
      </div>
    </button>
  );
}
