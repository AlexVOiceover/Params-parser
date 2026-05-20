"use client";

import { useState, useEffect, useCallback } from "react";
import { isNavCommand } from "./mission-commands";

export type WaypointAction =
  | "WAYPOINT"
  | "TAKEOFF"
  | "RETURN_TO_LAUNCH"
  | "LAND"
  | "LOITER_TIME"
  | "LOITER_TURNS"
  | "LOITER_UNLIM"
  | "DELAY"
  | "GUIDED_ENABLE"
  | "ATTITUDE_TIME"
  | "PAYLOAD_PLACE"
  | "SCRIPT_TIME"
  | "DO_SEND_SCRIPT_MESSAGE"
  | "SPLINE_WAYPOINT"
  | "IMAGE_START_CAPTURE"
  | "IMAGE_STOP_CAPTURE"
  | "SET_CAMERA_ZOOM"
  | "SET_CAMERA_FOCUS"
  | "SET_CAMERA_SOURCE"
  | "VIDEO_START_CAPTURE"
  | "VIDEO_STOP_CAPTURE"
  | "DO_AUX_FUNCTION"
  | "DO_CHANGE_SPEED"
  | "DO_DIGICAM_CONFIGURE"
  | "DO_DIGICAM_CONTROL"
  | "DO_ENGINE_CONTROL"
  | "DO_GIMBAL_MANAGER_PITCHYAW"
  | "DO_GRIPPER"
  | "DO_GUIDED_LIMITS"
  | "DO_JUMP"
  | "JUMP_TAG"
  | "DO_JUMP_TAG"
  | "DO_LAND_START"
  | "DO_MOUNT_CONTROL"
  | "DO_PARACHUTE"
  | "DO_REPEAT_RELAY"
  | "DO_REPEAT_SERVO"
  | "DO_SET_CAM_TRIGG_DIST"
  | "DO_SET_HOME"
  | "DO_SET_RELAY"
  | "DO_SET_RESUME_REPEAT_DIST"
  | "DO_SET_ROI"
  | "DO_SET_ROI_LOCATION"
  | "DO_SET_ROI_NONE"
  | "DO_SET_SERVO"
  | "DO_SPRAYER"
  | "DO_WINCH"
  | "CONDITION_DELAY"
  | "CONDITION_DISTANCE"
  | "CONDITION_YAW"
  | "UNKNOWN";

export interface Waypoint {
  id: string;
  seq: number;
  lat: number;
  lon: number;
  alt: number;
  action: WaypointAction;
  params?: Record<string, number>; // param1..param7
}

const STORAGE_KEY = "air6_mission_v1";

function reseq(waypoints: Waypoint[]): Waypoint[] {
  return waypoints.map((w, i) => ({ ...w, seq: i + 1 }));
}

const MAX_HISTORY = 50;

interface MissionState {
  waypoints: Waypoint[];
  history: Waypoint[][];
}

export function useMission() {
  const [state, setState] = useState<MissionState>({ waypoints: [], history: [] });
  const { waypoints, history } = state;
  const [loaded, setLoaded] = useState(false);

  // Single atomic update: snapshot current waypoints into history, apply updater
  function setWithHistory(updater: (prev: Waypoint[]) => Waypoint[]) {
    setState((s) => ({
      waypoints: updater(s.waypoints),
      history: [...s.history.slice(-MAX_HISTORY), s.waypoints],
    }));
  }

  // Thin wrapper so localStorage effect still works
  function setWaypoints(wps: Waypoint[]) {
    setState((s) => ({ ...s, waypoints: wps }));
  }

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ waypoints: JSON.parse(raw) as Waypoint[], history: [] });
    } catch {}
    setLoaded(true);
  }, []);

  // Persist to localStorage whenever waypoints change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(waypoints));
  }, [waypoints, loaded]);

  const addWaypoint = useCallback((lat: number, lon: number) => {
    setWithHistory((prev) => {
      const action: WaypointAction = prev.length === 0 ? "TAKEOFF" : "WAYPOINT";
      return reseq([...prev, {
        id: crypto.randomUUID(),
        seq: prev.length + 1,
        lat,
        lon,
        alt: 30,
        action,
      }]);
    });
  }, []);

  const updateWaypoint = useCallback((id: string, patch: Partial<Omit<Waypoint, "id" | "seq">>) => {
    setWithHistory((prev) => prev.map((w) => w.id === id ? { ...w, ...patch } : w));
  }, []);

  const removeWaypoint = useCallback((id: string) => {
    setWithHistory((prev) => reseq(prev.filter((w) => w.id !== id)));
  }, []);

  const moveUp = useCallback((id: string) => {
    setWithHistory((prev) => {
      const idx = prev.findIndex((w) => w.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return reseq(next);
    });
  }, []);

  const moveDown = useCallback((id: string) => {
    setWithHistory((prev) => {
      const idx = prev.findIndex((w) => w.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return reseq(next);
    });
  }, []);

  const clearAll = useCallback(() => setState({ waypoints: [], history: [] }), []);

  const loadWaypoints = useCallback((wps: Waypoint[]) => {
    setState({ waypoints: wps, history: [] });
  }, []);

  const reorderById = useCallback((activeId: string, overId: string) => {
    setWithHistory((prev) => {
      const oldIdx = prev.findIndex((w) => w.id === activeId);
      const newIdx = prev.findIndex((w) => w.id === overId);
      if (oldIdx < 0 || newIdx < 0 || oldIdx === newIdx) return prev;
      const next = [...prev];
      const [moved] = next.splice(oldIdx, 1);
      // Reset lat/lon for non-nav commands so they snap to their new segment position
      if (!isNavCommand(moved.action)) {
        next.splice(newIdx, 0, { ...moved, lat: 0, lon: 0 });
      } else {
        next.splice(newIdx, 0, moved);
      }
      return reseq(next);
    });
  }, []);

  const undo = useCallback(() => {
    setState((s) => {
      if (s.history.length === 0) return s;
      return {
        waypoints: s.history[s.history.length - 1],
        history: s.history.slice(0, -1),
      };
    });
  }, []);

  const canUndo = history.length > 0;

  return { waypoints, addWaypoint, updateWaypoint, removeWaypoint, moveUp, moveDown, clearAll, reorderById, loadWaypoints, undo, canUndo };
}
