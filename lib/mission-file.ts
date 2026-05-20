/**
 * MAVLink waypoints file format (.waypoints)
 * Compatible with Mission Planner, QGroundControl, and ArduPilot.
 *
 * Format: tab-separated, one waypoint per line
 * INDEX CURRENT FRAME COMMAND PARAM1 PARAM2 PARAM3 PARAM4 LAT LON ALT AUTOCONTINUE
 */

import type { Waypoint, WaypointAction } from "./use-mission";
import { isNavCommand } from "./mission-commands";

// MAVLink MAV_FRAME
const MAV_FRAME_GLOBAL_RELATIVE_ALT = 3;
const MAV_FRAME_MISSION = 2; // used for non-positional commands

// MAVLink MAV_CMD values
const MAV_CMD: Partial<Record<WaypointAction, number>> = {
  WAYPOINT:                   16,
  TAKEOFF:                    22,
  LAND:                       21,
  RETURN_TO_LAUNCH:           20,
  LOITER_UNLIM:               17,
  LOITER_TURNS:               18,
  LOITER_TIME:                19,
  SPLINE_WAYPOINT:            82,
  DO_LAND_START:              189,
  PAYLOAD_PLACE:              94,
  DO_CHANGE_SPEED:            178,
  DO_JUMP:                    177,
  JUMP_TAG:                   600,
  DO_JUMP_TAG:                601,
  DO_SET_SERVO:               183,
  DO_REPEAT_SERVO:            184,
  DO_SET_RELAY:               181,
  DO_REPEAT_RELAY:            182,
  DO_SET_CAM_TRIGG_DIST:      206,
  IMAGE_START_CAPTURE:        2000,
  IMAGE_STOP_CAPTURE:         2001,
  VIDEO_START_CAPTURE:        2500,
  VIDEO_STOP_CAPTURE:         2501,
  SET_CAMERA_ZOOM:            531,
  SET_CAMERA_FOCUS:           532,
  SET_CAMERA_SOURCE:          533,
  DO_MOUNT_CONTROL:           205,
  DO_GIMBAL_MANAGER_PITCHYAW: 1000,
  DO_SET_ROI:                 201,
  DO_SET_ROI_LOCATION:        195,
  DO_SET_ROI_NONE:            197,
  DO_GRIPPER:                 211,
  DO_PARACHUTE:               208,
  DO_SPRAYER:                 216,
  DO_WINCH:                   42600,
  DO_ENGINE_CONTROL:          223,
  DO_AUX_FUNCTION:            218,
  DO_GUIDED_LIMITS:           222,
  GUIDED_ENABLE:              92,
  DELAY:                      93,
  ATTITUDE_TIME:              2515,
  SCRIPT_TIME:                42600,
  DO_SEND_SCRIPT_MESSAGE:     42601,
  CONDITION_DELAY:            112,
  CONDITION_DISTANCE:         114,
  CONDITION_YAW:              115,
  DO_SET_HOME:                179,
  DO_SET_RESUME_REPEAT_DIST:  215,
  DO_DIGICAM_CONFIGURE:       202,
  DO_DIGICAM_CONTROL:         203,
  UNKNOWN:                    0,
};

// Reverse map: MAV_CMD number → WaypointAction
const CMD_TO_ACTION: Record<number, WaypointAction> = Object.fromEntries(
  Object.entries(MAV_CMD).map(([action, cmd]) => [cmd, action as WaypointAction])
);

function fmt(n: number | undefined, decimals = 7): string {
  return (n ?? 0).toFixed(decimals);
}

export function exportWaypointsFile(waypoints: Waypoint[]): string {
  const lines: string[] = ["QGC WPL 110"];

  // Index 0 is always the home/launch position in MAVLink waypoint files.
  // MP treats it as the ground reference point, not an actual mission command.
  // Use the first nav waypoint's position as home, or 0,0,0 if none.
  const firstNav = waypoints.find((w) => isNavCommand(w.action));
  const homeLine = [
    0,                                  // INDEX
    1,                                  // CURRENT (home is always current=1)
    MAV_FRAME_GLOBAL_RELATIVE_ALT,     // FRAME
    16,                                 // COMMAND: NAV_WAYPOINT (home)
    "0.0000", "0.0000", "0.0000", "0.0000",
    fmt(firstNav?.lat ?? 0),           // LAT
    fmt(firstNav?.lon ?? 0),           // LON
    "0.000",                            // ALT (home is at ground = 0)
    1,                                  // AUTOCONTINUE
  ].join("\t");
  lines.push(homeLine);

  // Pre-compute badge positions for non-nav commands so they get the
  // interpolated lat/lon of where the badge renders on the flight path.
  const badgePositions = new Map<string, { lat: number; lon: number }>();
  waypoints.forEach((w, idx) => {
    if (isNavCommand(w.action)) return;
    // If user manually dragged this action marker, use its stored position
    if (w.lat !== 0 && w.lon !== 0) {
      badgePositions.set(w.id, { lat: w.lat, lon: w.lon });
      return;
    }
    // Otherwise compute the interpolated position on the segment
    const prev = [...waypoints].slice(0, idx).reverse().find((p) => isNavCommand(p.action));
    const next = [...waypoints].slice(idx + 1).find((p) => isNavCommand(p.action));
    if (!prev || !next) return;
    const siblings = waypoints.filter(
      (s) => !isNavCommand(s.action) && s.seq > prev.seq && s.seq < next.seq
    );
    const posIdx = siblings.findIndex((s) => s.id === w.id);
    const t = (posIdx + 1) / (siblings.length + 1);
    badgePositions.set(w.id, {
      lat: prev.lat + t * (next.lat - prev.lat),
      lon: prev.lon + t * (next.lon - prev.lon),
    });
  });

  waypoints.forEach((w, i) => {
    const cmd = MAV_CMD[w.action] ?? 16;
    const p = w.params ?? {};
    const isCurrent = 0; // home (index 0) is already marked current=1 above
    const nav = isNavCommand(w.action);
    const badge = badgePositions.get(w.id);
    const cols = [
      i + 1,                                                    // INDEX (shifted by 1, home is 0)
      isCurrent,                                                // CURRENT
      MAV_FRAME_GLOBAL_RELATIVE_ALT,                           // FRAME
      cmd,                                                      // COMMAND
      fmt(p.param1 ?? 0, 4),                                   // PARAM1
      fmt(p.param2 ?? 0, 4),                                   // PARAM2
      fmt(p.param3 ?? 0, 4),                                   // PARAM3
      fmt(p.param4 ?? 0, 4),                                   // PARAM4
      nav ? fmt(w.lat) : badge ? fmt(badge.lat) : "0.0000000", // LAT
      nav ? fmt(w.lon) : badge ? fmt(badge.lon) : "0.0000000", // LON
      nav ? fmt(w.alt, 3) : "0.000",                           // ALT (0 for non-nav)
      1,                                                        // AUTOCONTINUE
    ];
    lines.push(cols.join("\t"));
  });
  return lines.join("\n") + "\n";
}

export function downloadWaypointsFile(waypoints: Waypoint[], filename = "mission.waypoints") {
  const content = exportWaypointsFile(waypoints);
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function parseWaypointsFile(content: string): Waypoint[] {
  const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0 || !lines[0].startsWith("QGC WPL")) {
    throw new Error("Not a valid QGC waypoints file");
  }

  const waypoints: Waypoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    if (cols.length < 12) continue;
    // Skip index 0 — it's the home/launch position, not a mission command
    if (parseInt(cols[0], 10) === 0) continue;
    const cmd = parseInt(cols[3], 10);
    const action: WaypointAction = CMD_TO_ACTION[cmd] ?? "UNKNOWN";
    const lat = parseFloat(cols[8]);
    const lon = parseFloat(cols[9]);
    const alt = parseFloat(cols[10]);
    const params: Record<string, number> = {};
    const p1 = parseFloat(cols[4]); if (p1 !== 0) params.param1 = p1;
    const p2 = parseFloat(cols[5]); if (p2 !== 0) params.param2 = p2;
    const p3 = parseFloat(cols[6]); if (p3 !== 0) params.param3 = p3;
    const p4 = parseFloat(cols[7]); if (p4 !== 0) params.param4 = p4;

    waypoints.push({
      id: crypto.randomUUID(),
      seq: waypoints.length + 1,
      lat, lon, alt, action,
      params: Object.keys(params).length > 0 ? params : undefined,
    });
  }
  return waypoints;
}
