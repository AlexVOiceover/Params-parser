/**
 * MAVLink mission command definitions.
 * Each command declares its meaningful parameters with labels and types.
 * Only commands with user-configurable params are listed here — commands
 * with no params (like RETURN_TO_LAUNCH) have an empty params array.
 */

export interface CommandParam {
  key: string;          // param1..param7
  label: string;        // human-readable name
  unit?: string;        // e.g. "m/s", "m", "deg", "s"
  type: "number" | "select";
  default?: number;
  min?: number;
  max?: number;
  options?: { value: number; label: string }[];
  expert?: boolean;     // hidden unless expert mode is on
}

export interface CommandDef {
  label: string;
  params: CommandParam[];
}

/** Commands that have a meaningful physical location on the map. */
export const NAV_COMMANDS = new Set([
  "WAYPOINT", "TAKEOFF", "LAND", "RETURN_TO_LAUNCH",
  "LOITER_TIME", "LOITER_TURNS", "LOITER_UNLIM", "SPLINE_WAYPOINT",
  "DO_LAND_START", "PAYLOAD_PLACE",
]);

export function isNavCommand(action: string): boolean {
  return NAV_COMMANDS.has(action);
}

export const COMMAND_DEFS: Partial<Record<string, CommandDef>> = {
  WAYPOINT: {
    label: "Waypoint",
    params: [
      { key: "param1", label: "Hold time", unit: "s", type: "number", default: 0, min: 0 },
      { key: "param2", label: "Accept radius", unit: "m", type: "number", default: 2, min: 0, expert: true },
      { key: "param3", label: "Pass radius", unit: "m", type: "number", default: 0, expert: true },
      { key: "param4", label: "Yaw angle", unit: "deg", type: "number", default: 0, min: 0, max: 360, expert: true },
    ],
  },
  TAKEOFF: {
    label: "Takeoff",
    params: [
      { key: "param4", label: "Yaw angle", unit: "deg", type: "number", default: 0, expert: true },
    ],
  },
  LAND: {
    label: "Land",
    params: [
      { key: "param1", label: "Abort altitude", unit: "m", type: "number", default: 0, min: 0, expert: true },
      { key: "param4", label: "Yaw angle", unit: "deg", type: "number", default: 0, expert: true },
    ],
  },
  LOITER_TIME: {
    label: "Loiter (time)",
    params: [
      { key: "param1", label: "Duration", unit: "s", type: "number", default: 10, min: 0 },
      { key: "param3", label: "Radius", unit: "m", type: "number", default: 0, expert: true },
      { key: "param4", label: "Yaw", unit: "deg", type: "number", default: 0, expert: true },
    ],
  },
  LOITER_TURNS: {
    label: "Loiter (turns)",
    params: [
      { key: "param1", label: "Turns", type: "number", default: 1, min: 0 },
      { key: "param3", label: "Radius", unit: "m", type: "number", default: 0, expert: true },
      { key: "param4", label: "Yaw", unit: "deg", type: "number", default: 0, expert: true },
    ],
  },
  LOITER_UNLIM: {
    label: "Loiter (unlimited)",
    params: [
      { key: "param3", label: "Radius", unit: "m", type: "number", default: 0, expert: true },
      { key: "param4", label: "Yaw", unit: "deg", type: "number", default: 0, expert: true },
    ],
  },
  SPLINE_WAYPOINT: {
    label: "Spline waypoint",
    params: [
      { key: "param1", label: "Hold time", unit: "s", type: "number", default: 0, min: 0 },
    ],
  },
  DELAY: {
    label: "Delay",
    params: [
      { key: "param1", label: "Duration", unit: "s", type: "number", default: 1, min: 0 },
    ],
  },
  DO_CHANGE_SPEED: {
    label: "Change speed",
    params: [
      { key: "param1", label: "Speed type", type: "select", default: 0, options: [
        { value: 0, label: "Airspeed" },
        { value: 1, label: "Ground speed" },
        { value: 2, label: "Climb speed" },
        { value: 3, label: "Descent speed" },
      ]},
      { key: "param2", label: "Speed", unit: "m/s", type: "number", default: 5, min: 0 },
      { key: "param3", label: "Throttle", unit: "%", type: "number", default: -1, min: -1, max: 100, expert: true },
    ],
  },
  DO_JUMP: {
    label: "Jump to waypoint",
    params: [
      { key: "param1", label: "Waypoint #", type: "number", default: 1, min: 1 },
      { key: "param2", label: "Repeat count", type: "number", default: 1, min: 1 },
    ],
  },
  JUMP_TAG: {
    label: "Jump tag",
    params: [
      { key: "param1", label: "Tag ID", type: "number", default: 1, min: 1 },
    ],
  },
  DO_JUMP_TAG: {
    label: "Jump to tag",
    params: [
      { key: "param1", label: "Tag ID", type: "number", default: 1, min: 1 },
      { key: "param2", label: "Repeat count", type: "number", default: 1, min: 1 },
    ],
  },
  CONDITION_DELAY: {
    label: "Condition delay",
    params: [
      { key: "param1", label: "Duration", unit: "s", type: "number", default: 1, min: 0 },
    ],
  },
  CONDITION_DISTANCE: {
    label: "Condition distance",
    params: [
      { key: "param1", label: "Distance", unit: "m", type: "number", default: 10, min: 0 },
    ],
  },
  CONDITION_YAW: {
    label: "Condition yaw",
    params: [
      { key: "param1", label: "Target angle", unit: "deg", type: "number", default: 0, min: 0, max: 360 },
      { key: "param3", label: "Direction", type: "select", default: 1, options: [
        { value: 1, label: "Clockwise" },
        { value: -1, label: "Counter-clockwise" },
      ]},
      { key: "param4", label: "Reference", type: "select", default: 0, options: [
        { value: 0, label: "Absolute" },
        { value: 1, label: "Relative" },
      ]},
      { key: "param2", label: "Turn rate", unit: "deg/s", type: "number", default: 0, min: 0, expert: true },
    ],
  },
  DO_SET_SERVO: {
    label: "Set servo",
    params: [
      { key: "param1", label: "Servo number", type: "number", default: 1, min: 1, max: 16 },
      { key: "param2", label: "PWM value", unit: "µs", type: "number", default: 1500, min: 800, max: 2200 },
    ],
  },
  DO_REPEAT_SERVO: {
    label: "Repeat servo",
    params: [
      { key: "param1", label: "Servo number", type: "number", default: 1, min: 1, max: 16 },
      { key: "param2", label: "PWM value", unit: "µs", type: "number", default: 1500, min: 800, max: 2200 },
      { key: "param3", label: "Cycle count", type: "number", default: 1, min: 1 },
      { key: "param4", label: "Cycle time", unit: "s", type: "number", default: 1, min: 0 },
    ],
  },
  DO_SET_RELAY: {
    label: "Set relay",
    params: [
      { key: "param1", label: "Relay number", type: "number", default: 0, min: 0 },
      { key: "param2", label: "State", type: "select", default: 1, options: [
        { value: 0, label: "Off" },
        { value: 1, label: "On" },
      ]},
    ],
  },
  DO_REPEAT_RELAY: {
    label: "Repeat relay",
    params: [
      { key: "param1", label: "Relay number", type: "number", default: 0, min: 0 },
      { key: "param2", label: "Cycle count", type: "number", default: 1, min: 1 },
      { key: "param3", label: "Cycle time", unit: "s", type: "number", default: 1, min: 0 },
    ],
  },
  DO_SET_CAM_TRIGG_DIST: {
    label: "Camera trigger distance",
    params: [
      { key: "param1", label: "Distance", unit: "m", type: "number", default: 0, min: 0 },
      { key: "param2", label: "Shutter integration", unit: "ms", type: "number", default: 0, min: 0 },
      { key: "param3", label: "Trigger once", type: "select", default: 0, options: [
        { value: 0, label: "Continuous" },
        { value: 1, label: "Once" },
      ]},
    ],
  },
  IMAGE_START_CAPTURE: {
    label: "Start image capture",
    params: [
      { key: "param2", label: "Interval", unit: "s", type: "number", default: 1, min: 0 },
      { key: "param3", label: "Total images", type: "number", default: 0, min: 0 },
    ],
  },
  IMAGE_STOP_CAPTURE: {
    label: "Stop image capture",
    params: [],
  },
  VIDEO_START_CAPTURE: {
    label: "Start video capture",
    params: [
      { key: "param1", label: "Stream ID", type: "number", default: 0, min: 0 },
      { key: "param2", label: "Status frequency", unit: "Hz", type: "number", default: 1, min: 0 },
    ],
  },
  VIDEO_STOP_CAPTURE: {
    label: "Stop video capture",
    params: [
      { key: "param1", label: "Stream ID", type: "number", default: 0, min: 0 },
    ],
  },
  DO_MOUNT_CONTROL: {
    label: "Mount control",
    params: [
      { key: "param1", label: "Pitch", unit: "deg", type: "number", default: 0 },
      { key: "param2", label: "Roll", unit: "deg", type: "number", default: 0 },
      { key: "param3", label: "Yaw", unit: "deg", type: "number", default: 0 },
    ],
  },
  DO_GIMBAL_MANAGER_PITCHYAW: {
    label: "Gimbal pitch/yaw",
    params: [
      { key: "param1", label: "Pitch", unit: "deg", type: "number", default: 0, min: -90, max: 90 },
      { key: "param2", label: "Yaw", unit: "deg", type: "number", default: 0, min: -180, max: 180 },
    ],
  },
  DO_SET_ROI_LOCATION: {
    label: "Set ROI location",
    params: [],
  },
  DO_SET_ROI_NONE: {
    label: "Clear ROI",
    params: [],
  },
  DO_GRIPPER: {
    label: "Gripper",
    params: [
      { key: "param1", label: "Instance", type: "number", default: 1, min: 1 },
      { key: "param2", label: "Action", type: "select", default: 0, options: [
        { value: 0, label: "Release" },
        { value: 1, label: "Grab" },
      ]},
    ],
  },
  DO_PARACHUTE: {
    label: "Parachute",
    params: [
      { key: "param1", label: "Action", type: "select", default: 0, options: [
        { value: 0, label: "Disable" },
        { value: 1, label: "Enable" },
        { value: 2, label: "Release" },
      ]},
    ],
  },
  DO_ENGINE_CONTROL: {
    label: "Engine control",
    params: [
      { key: "param1", label: "State", type: "select", default: 0, options: [
        { value: 0, label: "Stop" },
        { value: 1, label: "Start" },
      ]},
      { key: "param2", label: "Cold start", type: "select", default: 0, options: [
        { value: 0, label: "No" },
        { value: 1, label: "Yes" },
      ]},
      { key: "param3", label: "Height delay", unit: "m", type: "number", default: 0, min: 0 },
    ],
  },
  DO_AUX_FUNCTION: {
    label: "Aux function",
    params: [
      { key: "param1", label: "Function", type: "number", default: 0, min: 0 },
      { key: "param2", label: "Switch position", type: "select", default: 0, options: [
        { value: 0, label: "Low" },
        { value: 1, label: "Middle" },
        { value: 2, label: "High" },
      ]},
    ],
  },
  DO_SPRAYER: {
    label: "Sprayer",
    params: [
      { key: "param1", label: "State", type: "select", default: 0, options: [
        { value: 0, label: "Off" },
        { value: 1, label: "On" },
      ]},
    ],
  },
  DO_WINCH: {
    label: "Winch",
    params: [
      { key: "param1", label: "Instance", type: "number", default: 1, min: 1 },
      { key: "param2", label: "Action", type: "select", default: 0, options: [
        { value: 0, label: "Relax" },
        { value: 1, label: "Length control" },
        { value: 2, label: "Rate control" },
      ]},
      { key: "param3", label: "Length/Rate", type: "number", default: 0 },
    ],
  },
  DO_SET_HOME: {
    label: "Set home",
    params: [
      { key: "param1", label: "Use current pos", type: "select", default: 1, options: [
        { value: 0, label: "Use lat/lon below" },
        { value: 1, label: "Use current position" },
      ]},
    ],
  },
  PAYLOAD_PLACE: {
    label: "Payload place",
    params: [
      { key: "param1", label: "Max descent", unit: "m", type: "number", default: 0, min: 0 },
    ],
  },
  DO_GUIDED_LIMITS: {
    label: "Guided limits",
    params: [
      { key: "param1", label: "Timeout", unit: "s", type: "number", default: 0, min: 0 },
      { key: "param2", label: "Min altitude", unit: "m", type: "number", default: 0 },
      { key: "param3", label: "Max altitude", unit: "m", type: "number", default: 0 },
      { key: "param4", label: "Horiz limit", unit: "m", type: "number", default: 0, min: 0 },
    ],
  },
};
