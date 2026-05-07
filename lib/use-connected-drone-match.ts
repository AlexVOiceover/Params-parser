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
}

export type DroneMatchStatus = "idle" | "loading" | "matched" | "unmatched";
export type VersionStatus = "up_to_date" | "update_available" | "drone_ahead" | "unknown";

interface DroneMatchResult {
  status: DroneMatchStatus;
  drone: MatchedDrone | null;
  versionStatus: VersionStatus;
  droneVersion: number | null;
  catalogVersion: number | null;
}

// Cache key: "<scr_user1>_<scr_user2>" — busts when either changes.
const cache = new Map<string, MatchedDrone | null>();

function computeVersionStatus(drone: MatchedDrone | null): VersionStatus {
  if (!drone) return "unknown";
  const { drone_version, catalog_version } = drone;
  if (drone_version === null || catalog_version === null) return "unknown";
  // 0 is ArduPilot's factory default for SCR_USER2 — means "never flashed",
  // not "version 0". Treat it the same as missing.
  if (drone_version === 0) return "unknown";
  if (drone_version < catalog_version) return "update_available";
  if (drone_version === catalog_version) return "up_to_date";
  return "drone_ahead";
}

/**
 * Reads `SCR_USER1` (drone identity) and `SCR_USER2` (drone version) from the
 * connected drone params, resolves against the catalog via /api/drone/match,
 * and computes a version status comparison.
 */
export function useConnectedDroneMatch(): DroneMatchResult {
  const { droneParams } = useDroneParams();
  const idle: DroneMatchResult = { status: "idle", drone: null, versionStatus: "unknown", droneVersion: null, catalogVersion: null };
  const [result, setResult] = useState<DroneMatchResult>(idle);
  const lastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!droneParams || droneParams.length === 0) {
      lastKeyRef.current = null;
      setResult(idle);
      return;
    }

    const scrUser1 = droneParams.find((p) => p.name === "SCR_USER1");
    if (!scrUser1) {
      lastKeyRef.current = null;
      setResult(idle);
      return;
    }

    const wanted = parseInt(scrUser1.value, 10);
    if (!Number.isFinite(wanted)) {
      lastKeyRef.current = null;
      setResult(idle);
      return;
    }

    const scrUser2 = droneParams.find((p) => p.name === "SCR_USER2");
    const droneVersion = scrUser2 ? parseInt(scrUser2.value, 10) : null;
    const droneVersionOut = (droneVersion !== null && Number.isFinite(droneVersion)) ? droneVersion : null;

    const cacheKey = `${wanted}_${droneVersionOut ?? "null"}`;
    if (lastKeyRef.current === cacheKey) return;
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
      });
      return;
    }

    setResult({ status: "loading", drone: null, versionStatus: "unknown", droneVersion: droneVersionOut, catalogVersion: null });
    let cancelled = false;

    const url = droneVersionOut !== null
      ? `/api/drone/match?id=${wanted}&scr_user2=${droneVersionOut}`
      : `/api/drone/match?id=${wanted}`;

    fetch(url)
      .then((r) => r.json())
      .then((body: { drone: MatchedDrone | null }) => {
        if (cancelled) return;
        cache.set(cacheKey, body.drone);
        setResult({
          status: body.drone ? "matched" : "unmatched",
          drone: body.drone,
          versionStatus: computeVersionStatus(body.drone),
          droneVersion: body.drone?.drone_version ?? droneVersionOut,
          catalogVersion: body.drone?.catalog_version ?? null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setResult({ status: "unmatched", drone: null, versionStatus: "unknown", droneVersion: droneVersionOut, catalogVersion: null });
      });

    return () => { cancelled = true; };
  }, [droneParams]); // eslint-disable-line react-hooks/exhaustive-deps

  return result;
}
