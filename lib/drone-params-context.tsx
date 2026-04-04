"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";

import { DRONE_VERSION_ID, DRONE_STORAGE_KEY as STORAGE_KEY } from "@/lib/drone-params-shared";
export { DRONE_VERSION_ID };

interface DroneParam {
  name: string;
  value: string;
}

interface DroneParamsContextValue {
  droneParams: DroneParam[] | null;
  setDroneParams: (params: DroneParam[]) => void;
  clearDroneParams: () => void;
}

const DroneParamsContext = createContext<DroneParamsContextValue>({
  droneParams: null,
  setDroneParams: () => {},
  clearDroneParams: () => {},
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

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = readStorage();
    console.log("[DroneParams] hydrate from localStorage:", stored ? `${stored.length} params` : "null");
    setDroneParamsState(stored);
  }, []);

  const setDroneParams = useCallback((params: DroneParam[]) => {
    console.log("[DroneParams] setDroneParams called:", params.length, "params");
    setDroneParamsState(params);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(params)); } catch {}
  }, []);

  const clearDroneParams = useCallback(() => {
    setDroneParamsState(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return (
    <DroneParamsContext.Provider value={{ droneParams, setDroneParams, clearDroneParams }}>
      {children}
    </DroneParamsContext.Provider>
  );
}

export function useDroneParams(): DroneParamsContextValue {
  return useContext(DroneParamsContext);
}

/** Save drone params from outside the context (e.g., from the filter page). */
export function saveDroneParamsToStorage(params: DroneParam[]): void {
  console.log("[DroneParams] saveDroneParamsToStorage:", params.length, "params");
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(params)); } catch {}
}
