"use client";

import { useEffect, useState } from "react";
import { useDroneParams } from "@/lib/drone-params-context";
import type {
  DroneState,
  LinkCandidate,
  MatchedDrone,
  MatchResponse,
  ParamDiff,
  VersionRef,
} from "@/lib/desired-state";

/**
 * idle     — no drone read
 * no_chip  — the read has no chip ID (MAVLink v1, or the FC never answered)
 * linked   — chip linked to a drone record; `state` says how it compares
 * unlinked — chip not linked yet; staff get `candidates`
 */
export type DroneMatchStatus = "idle" | "no_chip" | "loading" | "linked" | "unlinked" | "error";

export interface DroneMatchResult {
  status: DroneMatchStatus;
  drone: MatchedDrone | null;
  state: DroneState | null;
  desired: VersionRef | null;
  pending: VersionRef | null;
  lastVerified: VersionRef | null;
  diff: ParamDiff[];
  firmwareMismatch: boolean;
  droneFirmware: string | null;
  candidates: LinkCandidate[];
  suggestedId: string | null;
}

const IDLE: DroneMatchResult = {
  status: "idle",
  drone: null,
  state: null,
  desired: null,
  pending: null,
  lastVerified: null,
  diff: [],
  firmwareMismatch: false,
  droneFirmware: null,
  candidates: [],
  suggestedId: null,
};

// One request per (chip, params) — every component using the hook shares it.
const cache = new Map<string, Promise<MatchResponse | null>>();
const listeners = new Set<() => void>();
let generation = 0;

/** Re-check the connected drone against the catalog (after a link, apply, save or catalog edit). */
export function refreshDroneMatch(): void {
  cache.clear();
  generation++;
  for (const fn of listeners) fn();
}

function checksum(params: { name: string; value: string }[]): number {
  let acc = 0;
  for (const p of params) {
    let h = 0;
    const s = p.name + "=" + p.value;
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    acc = (acc ^ h) | 0;
  }
  return acc;
}

export function useConnectedDroneMatch(): DroneMatchResult {
  const { droneParams, autopilot } = useDroneParams();
  const [gen, setGen] = useState(generation);
  const [result, setResult] = useState<DroneMatchResult>(IDLE);

  useEffect(() => {
    const onRefresh = () => setGen(generation);
    listeners.add(onRefresh);
    return () => { listeners.delete(onRefresh); };
  }, []);

  useEffect(() => {
    if (!droneParams || droneParams.length === 0) {
      setResult(IDLE);
      return;
    }
    const chipId = autopilot?.chipId ?? null;
    const droneFirmware = autopilot?.firmware ?? null;
    if (!chipId) {
      setResult({ ...IDLE, status: "no_chip", droneFirmware });
      return;
    }

    const key = `${chipId}_${checksum(droneParams)}`;
    let request = cache.get(key);
    if (!request) {
      const hint = parseInt(droneParams.find((p) => p.name === "SCR_USER1")?.value ?? "", 10);
      request = fetch("/api/drone/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chipId,
          firmware: droneFirmware,
          params: droneParams,
          scrUser1Hint: Number.isFinite(hint) && hint > 0 ? hint : null,
        }),
      })
        .then((r) => (r.ok ? (r.json() as Promise<MatchResponse>) : null))
        .catch(() => null);
      cache.set(key, request);
    }

    let cancelled = false;
    setResult((prev) => (prev.status === "idle" || prev.status === "no_chip" ? { ...IDLE, status: "loading", droneFirmware } : prev));
    void request.then((res) => {
      if (cancelled) return;
      if (!res) {
        cache.delete(key);
        setResult({ ...IDLE, status: "error", droneFirmware });
      } else if (res.linked) {
        setResult({
          ...IDLE,
          status: "linked",
          drone: res.drone,
          state: res.state,
          desired: res.desired,
          pending: res.pending,
          lastVerified: res.lastVerified,
          diff: res.diff,
          firmwareMismatch: res.firmwareMismatch,
          droneFirmware,
        });
      } else {
        setResult({ ...IDLE, status: "unlinked", candidates: res.candidates, suggestedId: res.suggestedId, droneFirmware });
      }
    });
    return () => { cancelled = true; };
  }, [droneParams, autopilot, gen]);

  return result;
}
