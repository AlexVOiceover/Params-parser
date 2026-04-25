"use client";

import Link from "next/link";
import { Usb, Unplug } from "lucide-react";
import { useDroneParams } from "@/lib/drone-params-context";

export function ConnectedDroneCard() {
  const { droneParams } = useDroneParams();
  const hasParams = droneParams !== null && droneParams.length > 0;

  if (hasParams) {
    return (
      <Link
        href="/catalog/compare?v=__drone__"
        className="group/card flex flex-col gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-5 hover:border-emerald-400 hover:bg-emerald-500/15 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Usb className="h-4 w-4 text-emerald-500 shrink-0" />
          <span className="font-semibold text-emerald-700 dark:text-emerald-300 group-hover/card:text-emerald-600 dark:group-hover/card:text-emerald-200 transition-colors">
            Connected drone
          </span>
        </div>
        <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 leading-relaxed">
          Live params read from USB. Click to view or compare.
        </p>
        <div className="mt-auto pt-3 border-t border-emerald-500/30">
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {droneParams.length} params loaded
          </span>
        </div>
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-rose-500/40 bg-rose-500/5 p-5 cursor-default">
      <div className="flex items-center gap-2">
        <Unplug className="h-4 w-4 text-rose-500 shrink-0" />
        <span className="font-semibold text-rose-700 dark:text-rose-300">
          No drone connected
        </span>
      </div>
      <p className="text-xs text-rose-700/80 dark:text-rose-300/80 leading-relaxed">
        Use &ldquo;Import from drone&rdquo; in the header to read live params via USB.
      </p>
      <div className="mt-auto pt-3 border-t border-rose-500/30">
        <span className="text-xs text-rose-700/70 dark:text-rose-300/70">
          Not available
        </span>
      </div>
    </div>
  );
}
