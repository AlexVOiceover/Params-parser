"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { DRONE_VERSION_ID, DRONE_STORAGE_KEY as STORAGE_KEY } from "@/lib/drone-params-shared";
import { ConnectDroneDialog } from "@/components/connect-drone-dialog";
import type { Param } from "@/lib/types";
export { DRONE_VERSION_ID };

interface DroneParam {
  name: string;
  value: string;
}

interface DroneParamsContextValue {
  droneParams: DroneParam[] | null;
  setDroneParams: (params: DroneParam[]) => void;
  clearDroneParams: () => void;
  openImportDialog: () => void;
}

const DroneParamsContext = createContext<DroneParamsContextValue>({
  droneParams: null,
  setDroneParams: () => {},
  clearDroneParams: () => {},
  openImportDialog: () => {},
});

function readStorage(): DroneParam[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return null;
}

export function DroneParamsProvider({ children }: { children: ReactNode }) {
  const [droneParams, setDroneParamsState] = useState<DroneParam[] | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = readStorage();
    setDroneParamsState(stored);
  }, []);

  const setDroneParams = useCallback((params: DroneParam[]) => {
    setDroneParamsState(params);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(params)); } catch {}
  }, []);

  const clearDroneParams = useCallback(() => {
    setDroneParamsState(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    const viewing = searchParams.getAll("v");
    if (pathname === "/compare" && viewing.includes(DRONE_VERSION_ID)) {
      router.push("/");
    }
  }, [pathname, searchParams, router]);

  const openImportDialog = useCallback(() => setImportDialogOpen(true), []);

  const handleParamsLoaded = useCallback(
    (params: Param[]) => {
      setDroneParams(params.map((p) => ({ name: p.name, value: p.value })));
    },
    [setDroneParams]
  );

  return (
    <DroneParamsContext.Provider
      value={{ droneParams, setDroneParams, clearDroneParams, openImportDialog }}
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

/** Save drone params from outside the context (e.g., from the filter page). */
export function saveDroneParamsToStorage(params: DroneParam[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(params)); } catch {}
}

/** Count of params currently stored (0 if none / unavailable). */
export function getStoredDroneParamsCount(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch { return 0; }
}

/** Clear drone params from localStorage (used from pages without the provider). */
export function clearDroneParamsFromStorage(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}
