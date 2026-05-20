import type { Waypoint, WaypointAction } from "./use-mission";
import { isNavCommand } from "./mission-commands";

export interface WaypointWarning {
  waypointId: string;
  type: "error" | "warning";
  message: string;
}

const TERMINAL_NAV: WaypointAction[] = ["RETURN_TO_LAUNCH", "LAND", "DO_LAND_START"];

export function validateMission(waypoints: Waypoint[]): WaypointWarning[] {
  const warnings: WaypointWarning[] = [];

  // Find index of first terminal nav command
  const terminalIdx = waypoints.findIndex((w) => TERMINAL_NAV.includes(w.action));

  waypoints.forEach((w, i) => {
    // Commands after a terminal nav command are unreachable
    if (terminalIdx !== -1 && i > terminalIdx) {
      warnings.push({
        waypointId: w.id,
        type: "error",
        message: `Unreachable — mission ends at ${waypoints[terminalIdx].action.replace(/_/g, " ")} (#${waypoints[terminalIdx].seq})`,
      });
    }

    // TAKEOFF must be the first nav command
    if (w.action === "TAKEOFF") {
      const firstNav = waypoints.find((x) => isNavCommand(x.action));
      if (firstNav && firstNav.id !== w.id) {
        warnings.push({
          waypointId: w.id,
          type: "error",
          message: "TAKEOFF must be the first navigation command",
        });
      }
    }

    // Action commands as the very last item (no nav command follows)
    if (!isNavCommand(w.action)) {
      const hasNavAfter = waypoints.slice(i + 1).some((x) => isNavCommand(x.action));
      if (!hasNavAfter && terminalIdx === -1) {
        warnings.push({
          waypointId: w.id,
          type: "warning",
          message: "No waypoint follows — this action may never execute",
        });
      }
    }

    // DO_JUMP target waypoint must exist
    if (w.action === "DO_JUMP" && w.params?.param1) {
      const target = Math.round(w.params.param1);
      const exists = waypoints.some((x) => x.seq === target);
      if (!exists) {
        warnings.push({
          waypointId: w.id,
          type: "error",
          message: `Target waypoint #${target} does not exist`,
        });
      }
    }

    // First waypoint should ideally be TAKEOFF
    if (i === 0 && w.action !== "TAKEOFF") {
      warnings.push({
        waypointId: w.id,
        type: "warning",
        message: "Mission should start with TAKEOFF",
      });
    }
  });

  return warnings;
}
