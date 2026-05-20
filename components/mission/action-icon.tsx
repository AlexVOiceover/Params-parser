"use client";

import { Plane, PlaneLanding, RotateCcw, Anchor, Navigation, Gauge, GitBranch, Camera, Video, Crosshair, Wrench, Package, Zap, Code, HelpCircle } from "lucide-react";
import type { WaypointAction } from "@/lib/use-mission";

export function actionColor(action: WaypointAction): string {
  if (action === "TAKEOFF") return "#22c55e";
  if (action === "LAND" || action === "DO_LAND_START") return "#ef4444";
  if (action === "RETURN_TO_LAUNCH") return "#f97316";
  if (action === "LOITER_TIME" || action === "LOITER_TURNS" || action === "LOITER_UNLIM") return "#8b5cf6";
  if (action === "DO_CHANGE_SPEED") return "#06b6d4";
  if (action === "DO_JUMP" || action === "JUMP_TAG" || action === "DO_JUMP_TAG") return "#ec4899";
  if (action === "IMAGE_START_CAPTURE" || action === "IMAGE_STOP_CAPTURE" || action === "VIDEO_START_CAPTURE" || action === "VIDEO_STOP_CAPTURE" || action === "SET_CAMERA_ZOOM" || action === "SET_CAMERA_FOCUS" || action === "SET_CAMERA_SOURCE" || action === "DO_DIGICAM_CONFIGURE" || action === "DO_DIGICAM_CONTROL" || action === "DO_SET_CAM_TRIGG_DIST") return "#a855f7";
  if (action === "DO_MOUNT_CONTROL" || action === "DO_GIMBAL_MANAGER_PITCHYAW" || action === "DO_SET_ROI" || action === "DO_SET_ROI_LOCATION" || action === "DO_SET_ROI_NONE") return "#14b8a6";
  if (action === "CONDITION_YAW" || action === "CONDITION_DELAY" || action === "CONDITION_DISTANCE" || action === "DELAY") return "#f59e0b";
  if (action === "WAYPOINT" || action === "SPLINE_WAYPOINT") return "#f59e0b";
  return "#6366f1";
}

export function ActionIcon({ action, size = 14 }: { action: WaypointAction; size?: number }) {
  const s = { width: size, height: size };
  if (action === "WAYPOINT" || action === "SPLINE_WAYPOINT") return <Navigation style={s} />;
  if (action === "TAKEOFF") return <Plane style={s} />;
  if (action === "LAND" || action === "DO_LAND_START") return <PlaneLanding style={s} />;
  if (action === "RETURN_TO_LAUNCH") return <RotateCcw style={s} />;
  if (action === "LOITER_TIME" || action === "LOITER_TURNS" || action === "LOITER_UNLIM") return <Anchor style={s} />;
  if (action === "DO_CHANGE_SPEED") return <Gauge style={s} />;
  if (action === "DO_JUMP" || action === "JUMP_TAG" || action === "DO_JUMP_TAG") return <GitBranch style={s} />;
  if (action === "IMAGE_START_CAPTURE" || action === "IMAGE_STOP_CAPTURE" || action === "DO_DIGICAM_CONFIGURE" || action === "DO_DIGICAM_CONTROL" || action === "DO_SET_CAM_TRIGG_DIST" || action === "SET_CAMERA_ZOOM" || action === "SET_CAMERA_FOCUS" || action === "SET_CAMERA_SOURCE") return <Camera style={s} />;
  if (action === "VIDEO_START_CAPTURE" || action === "VIDEO_STOP_CAPTURE") return <Video style={s} />;
  if (action === "DO_MOUNT_CONTROL" || action === "DO_GIMBAL_MANAGER_PITCHYAW" || action === "DO_SET_ROI" || action === "DO_SET_ROI_LOCATION" || action === "DO_SET_ROI_NONE") return <Crosshair style={s} />;
  if (action === "DO_SET_SERVO" || action === "DO_REPEAT_SERVO" || action === "DO_SET_RELAY" || action === "DO_REPEAT_RELAY" || action === "DO_ENGINE_CONTROL" || action === "DO_AUX_FUNCTION") return <Wrench style={s} />;
  if (action === "PAYLOAD_PLACE" || action === "DO_GRIPPER" || action === "DO_PARACHUTE" || action === "DO_SPRAYER" || action === "DO_WINCH") return <Package style={s} />;
  if (action === "SCRIPT_TIME" || action === "DO_SEND_SCRIPT_MESSAGE") return <Code style={s} />;
  if (action === "CONDITION_YAW" || action === "CONDITION_DELAY" || action === "CONDITION_DISTANCE" || action === "DELAY") return <Zap style={s} />;
  return <HelpCircle style={s} />;
}
