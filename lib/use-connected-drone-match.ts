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
  catalog_version: number | null;
  latest_version_id: string | null;
  drone_version: number | null;
  is_orphan: boolean;
  drift_count: number | null;
  client_set_id: string | null;
  initialised_at: string | null;
}

export type DroneMatchStatus = "idle" | "loading" | "matched" | "unmatched";
export type VersionStatus = "up_to_date" | "update_available" | "drone_ahead" | "unknown" | "up_to_date_modified";

interface DroneMatchResult {
  status: DroneMatchStatus;
  drone: MatchedDrone | null;
  versionStatus: VersionStatus;
  droneVersion: number | null;
  catalogVersion: number | null;
  isOrphan: boolean;
  driftCount: number | null;
}

// Cache key: "<scr_user1>_<scr_user2>" — busts when either changes.
const cache = new Map<string, MatchedDrone | null>();

/** Clear the entire match cache — call after catalog changes (delete, edit). */
export function clearDroneMatchCache() { cache.clear(); }

function computeVersionStatus(drone: MatchedDrone | null): VersionStatus {
  if (!drone) return "unknown";
  const { drone_version, catalog_version } = drone;
  if (drone_version === null || catalog_version === null) return "unknown";
  // 0 is ArduPilot's factory default for SCR_USER2 — means "never flashed",
  // not "version 0". Treat it the same as missing.
  if (drone_version === 0) return "unknown";
  if (drone_version < catalog_version) return "update_available";
  if (drone_version === catalog_version) {
    // If a param-level diff was computed and found differences, flag as modified.
    if (drone.drift_count !== null && drone.drift_count > 0) return "up_to_date_modified";
    return "up_to_date";
  }
  return "drone_ahead";
}

/**
 * Reads `SCR_USER1` (drone identity) and `SCR_USER2` (drone version) from the
 * connected drone params, resolves against the catalog via /api/drone/match,
 * and computes a version status comparison.
 */
export function useConnectedDroneMatch(): DroneMatchResult {
  const { droneParams } = useDroneParams();
  const idle: DroneMatchResult = { status: "idle", drone: null, versionStatus: "unknown", droneVersion: null, catalogVersion: null, isOrphan: false, driftCount: null };
  const [result, setResult] = useState<DroneMatchResult>(idle);
  const lastKeyRef = useRef<string | null>(null);
  // When set to true by the interval below, forces a re-fetch on the next tick
  // even if the cache key hasn't changed (used after clearDroneMatchCache).
  const forceFetchRef = useRef(false);
  useEffect(() => {
    const id = setInterval(() => {
      if (lastKeyRef.current !== null && !cache.has(lastKeyRef.current)) {
        forceFetchRef.current = true;
        // Trigger re-render by calling a no-op setState so the main effect fires
        setResult((prev) => ({ ...prev }));
      }
    }, 300);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!droneParams || droneParams.length === 0) {
      lastKeyRef.current = null;
      setResult(idle);
      return;
    }

    // SCR_USER1/2 require SCR_ENABLE=1. On a factory-fresh drone SCR_ENABLE=0
    // and the SCR_ params may be absent entirely. Treat missing or zero SCR_USER1
    // as a blank drone (wanted=0) so the match returns "unmatched" and the
    // Register button appears — rather than returning idle and showing nothing.
    const scrEnable = droneParams.find((p) => p.name === "SCR_ENABLE");
    const scrUser1 = droneParams.find((p) => p.name === "SCR_USER1");
    const scrEnabled = scrEnable ? parseInt(scrEnable.value, 10) !== 0 : false;

    // If scripting is disabled and SCR_USER1 is absent, this is a blank drone.
    // Use wanted=0 so the match API returns null → status "unmatched" → Register shows.
    const rawWanted = scrUser1 ? parseInt(scrUser1.value, 10) : 0;
    const wanted = Number.isFinite(rawWanted) ? rawWanted : 0;

    // If SCR_ENABLE=0 and SCR_USER1 is missing/0, skip the network fetch entirely —
    // we know it won't match anything. Set unmatched directly so Register shows immediately.
    if (!scrEnabled && wanted === 0) {
      lastKeyRef.current = `unscripted_${droneParams.length}`;
      setResult({
        status: "unmatched",
        drone: null,
        versionStatus: "unknown",
        droneVersion: null,
        catalogVersion: null,
        isOrphan: false,
        driftCount: null,
      });
      return;
    }

    const scrUser2 = droneParams.find((p) => p.name === "SCR_USER2");
    const droneVersion = scrUser2 ? parseInt(scrUser2.value, 10) : null;
    const droneVersionOut = (droneVersion !== null && Number.isFinite(droneVersion)) ? droneVersion : null;

    // Include a lightweight checksum of all param values so the drift check
    // re-runs whenever the drone is re-imported with different values.
    const paramChecksum = droneParams.reduce((acc, p) => {
      let h = 0;
      for (let i = 0; i < p.value.length; i++) h = (Math.imul(31, h) + p.value.charCodeAt(i)) | 0;
      return (acc ^ h) | 0;
    }, 0);
    const cacheKey = `${wanted}_${droneVersionOut ?? "null"}_${paramChecksum}`;
    const forced = forceFetchRef.current;
    forceFetchRef.current = false;
    // Skip re-fetch if key is unchanged and cache entry still exists (not cleared).
    if (lastKeyRef.current === cacheKey && cache.has(cacheKey) && !forced) return;
    lastKeyRef.current = cacheKey;

    // When the key changes (e.g. after SCR_USER2 is written), always
    // clear the old cache entry so we re-fetch with the new version value.
    if (lastKeyRef.current !== null && lastKeyRef.current !== cacheKey) {
      cache.delete(lastKeyRef.current);
    }

    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey) ?? null;
      setResult({
        status: cached ? "matched" : "unmatched",
        drone: cached,
        versionStatus: computeVersionStatus(cached),
        droneVersion: cached?.drone_version ?? null,
        catalogVersion: cached?.catalog_version ?? null,
        isOrphan: cached?.is_orphan ?? false,
          driftCount: cached?.drift_count ?? null,
      });
      return;
    }

    setResult({ status: "loading", drone: null, versionStatus: "unknown", droneVersion: droneVersionOut, catalogVersion: null, isOrphan: false, driftCount: null });
    let cancelled = false;

    let url = `/api/drone/match?id=${wanted}`;
    if (droneVersionOut !== null) url += `&scr_user2=${droneVersionOut}`;

    fetch(url)
      .then((r) => r.json())
      .then(async (body: { drone: MatchedDrone | null }) => {
        if (cancelled) return;

        let drone = body.drone;
        const initialStatus = computeVersionStatus(drone);

        // If version matches, run drift check via a separate POST so we don't
        // blow the URL length limit with ~50KB of encoded params.
        if (
          drone &&
          initialStatus === "up_to_date" &&
          drone.latest_version_id &&
          droneParams &&
          droneParams.length > 0
        ) {
          try {
            const paramObj: Record<string, string> = {};
            for (const p of droneParams) paramObj[p.name] = p.value;
            const driftRes = await fetch("/api/drone/drift", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ versionId: drone.latest_version_id, params: paramObj }),
            });
            if (!cancelled && driftRes.ok) {
              const { drift_count } = await driftRes.json() as { drift_count: number | null };
              drone = { ...drone, drift_count };
            }
          } catch { /* drift check failed — treat as no drift */ }
        }

        if (cancelled) return;
        cache.set(cacheKey, drone);

        // If the drone has SCR_USER2 > 0 it has been physically initialised —
        // mark it in the DB if not already set, so Clients & Drones reflects reality.
        if (drone && drone.drone_version !== null && drone.drone_version > 0 && !drone.initialised_at) {
          fetch(`/api/admin/drones/${drone.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ initialisedAt: true }),
          }).catch(() => {});
        }

        setResult({
          status: drone ? "matched" : "unmatched",
          drone,
          versionStatus: computeVersionStatus(drone),
          droneVersion: drone?.drone_version ?? droneVersionOut,
          catalogVersion: drone?.catalog_version ?? null,
          isOrphan: drone?.is_orphan ?? false,
          driftCount: drone?.drift_count ?? null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setResult({ status: "unmatched", drone: null, versionStatus: "unknown", droneVersion: droneVersionOut, catalogVersion: null, isOrphan: false, driftCount: null });
      });

    return () => { cancelled = true; };
  }, [droneParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return result;
}
