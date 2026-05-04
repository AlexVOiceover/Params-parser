"use client";

import { useEffect, useRef, useState } from "react";
import { useDroneParams } from "@/lib/drone-params-context";

export interface MatchedDrone {
  id: string;
  serial: string;
  client_id: string | null;
  variant_id: string;
  client_name: string | null;
  family_slug: string | null;
  family_name: string | null;
  variant_name: string | null;
}

export type DroneMatchStatus = "idle" | "loading" | "matched" | "unmatched";

interface DroneMatchResult {
  status: DroneMatchStatus;
  drone: MatchedDrone | null;
}

const cache = new Map<number, MatchedDrone | null>();

/**
 * Reads `SCR_USER1` from the connected drone params and resolves it against
 * the user's accessible drones via /api/drone/match.
 *
 * Returns `idle` when no drone is connected or no SCR_USER1 is present.
 * Returns `loading` while a fetch is in flight, `matched` / `unmatched` after.
 */
export function useConnectedDroneMatch(): DroneMatchResult {
  const { droneParams } = useDroneParams();
  const [result, setResult] = useState<DroneMatchResult>({ status: "idle", drone: null });
  const lastIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!droneParams || droneParams.length === 0) {
      lastIdRef.current = null;
      setResult({ status: "idle", drone: null });
      return;
    }

    const scrUser1 = droneParams.find((p) => p.name === "SCR_USER1");
    if (!scrUser1) {
      lastIdRef.current = null;
      setResult({ status: "idle", drone: null });
      return;
    }

    const wanted = parseInt(scrUser1.value, 10);
    if (!Number.isFinite(wanted)) {
      lastIdRef.current = null;
      setResult({ status: "idle", drone: null });
      return;
    }

    if (lastIdRef.current === wanted) return;
    lastIdRef.current = wanted;

    if (cache.has(wanted)) {
      const cached = cache.get(wanted) ?? null;
      setResult({ status: cached ? "matched" : "unmatched", drone: cached });
      return;
    }

    setResult({ status: "loading", drone: null });
    let cancelled = false;
    fetch(`/api/drone/match?id=${wanted}`)
      .then((r) => r.json())
      .then((body: { drone: MatchedDrone | null }) => {
        if (cancelled) return;
        cache.set(wanted, body.drone);
        setResult({ status: body.drone ? "matched" : "unmatched", drone: body.drone });
      })
      .catch(() => {
        if (cancelled) return;
        setResult({ status: "unmatched", drone: null });
      });

    return () => {
      cancelled = true;
    };
  }, [droneParams]);

  return result;
}
