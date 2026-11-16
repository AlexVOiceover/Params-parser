"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import {
  DRONE_VERSION_ID,
  DRONE_STORAGE_KEY,
  setSnapshotChipId,
  onDroneMismatch,
} from "@/lib/drone-params-shared";
import type { AutopilotInfo } from "@/lib/mavlink-serial";
import { ConnectDroneDialog } from "@/components/connect-drone-dialog";
import type { Param } from "@/lib/types";
export { DRONE_VERSION_ID };

interface DroneParam {
  name: string;
  value: string;
}

interface DroneParamsContextValue {
  droneParams: DroneParam[] | null;
  /** When the params were last read from the drone (ms epoch). */
  readAt: number | null;
  /** Chip ID and firmware the FC reported during that read; null if it reported none. */
  autopilot: AutopilotInfo | null;
  setDroneParams: (params: DroneParam[]) => void;
  clearDroneParams: () => void;
  openImportDialog: () => void;
}

const DroneParamsContext = createContext<DroneParamsContextValue>({
  droneParams: null,
  readAt: null,
  autopilot: null,
  setDroneParams: () => {},
  clearDroneParams: () => {},
  openImportDialog: () => {},
});

type DisconnectSource = Navigator & { serial?: EventTarget; usb?: EventTarget };

// The snapshot lives in memory only. It describes whichever drone was plugged
// in at read time, so it must not outlive the USB connection or the session.
export function DroneParamsProvider({ children }: { children: ReactNode }) {
  const [droneParams, setDroneParamsState] = useState<DroneParam[] | null>(null);
  const [readAt, setReadAt] = useState<number | null>(null);
  const [autopilot, setAutopilot] = useState<AutopilotInfo | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const resetSnapshot = useCallback(() => {
    setDroneParamsState(null);
    setReadAt(null);
    setAutopilot(null);
    setSnapshotChipId(null);
  }, []);

  // Older versions kept the snapshot in localStorage indefinitely — drop it.
  useEffect(() => {
    try { localStorage.removeItem(DRONE_STORAGE_KEY); } catch {}
  }, []);

  // Unplugging any USB serial device invalidates the snapshot: the next drone
  // plugged in is not known to be the same one.
  useEffect(() => {
    const nav = navigator as DisconnectSource;
    const sources = [nav.serial, nav.usb].filter((s): s is EventTarget => !!s);
    for (const s of sources) s.addEventListener("disconnect", resetSnapshot);
    const unsubscribe = onDroneMismatch(resetSnapshot);
    return () => {
      for (const s of sources) s.removeEventListener("disconnect", resetSnapshot);
      unsubscribe();
    };
  }, [resetSnapshot]);

  const setDroneParams = useCallback((params: DroneParam[]) => {
    setDroneParamsState(params);
  }, []);

  const clearDroneParams = useCallback(() => {
    resetSnapshot();
    const viewing = searchParams.getAll("v");
    if (pathname === "/compare" && viewing.includes(DRONE_VERSION_ID)) {
      router.push("/");
    }
  }, [resetSnapshot, pathname, searchParams, router]);

  const openImportDialog = useCallback(() => setImportDialogOpen(true), []);

  const handleParamsLoaded = useCallback((params: Param[], info: AutopilotInfo | null) => {
    setSnapshotChipId(info?.chipId ?? null);
    setAutopilot(info);
    setDroneParamsState(params.map((p) => ({ name: p.name, value: p.value })));
    setReadAt(Date.now());
  }, []);

  return (
    <DroneParamsContext.Provider
      value={{ droneParams, readAt, autopilot, setDroneParams, clearDroneParams, openImportDialog }}
    >
      {children}
      {importDialogOpen && (
        <ConnectDroneDialog
          onParamsLoaded={handleParamsLoaded}
          onClose={() => setImportDialogOpen(false)}
          onForget={clearDroneParams}
        />
      )}
    </DroneParamsContext.Provider>
  );
}

export function useDroneParams(): DroneParamsContextValue {
  return useContext(DroneParamsContext);
}
