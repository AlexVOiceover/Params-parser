# Plan — Client GCS

Goal: evolve the app into a client-facing ground control station where param changes are locked by regulation, firmware updates are pushed through the catalog, and clients can plan and upload missions — without ever needing Mission Planner.

All previous stages (07–18) have shipped.

---

## Stage 18 — Map + mission planning UI

Give clients a way to create and edit waypoint missions visually on a map, without exposing any param controls.

- **Map component**: embed Leaflet (or MapLibre) in a new `/mission` page. Show the drone's last known position if available. Support satellite and street tile layers.
- **Mission editor**: click map to add waypoints. Each waypoint has: lat/lon, altitude (relative), optional action (takeoff, land, RTL, loiter). Drag to reposition. Delete individual waypoints. Reorder via list.
- **Mission list sidebar**: list of waypoints with altitude and action. Editable inline.
- **No param access on this page** — purely for mission planning.
- **Save to browser**: persist the current mission in localStorage so it survives a page refresh.

Out of scope: uploading to drone (Stage 19), flight mode control (Stage 20).

---

## Stage 19 — Mission upload/download via MAVLink

Connect the mission editor to the physical drone. Upload missions and read back what's on the FC.

- **MAVLink mission protocol**: implement `MISSION_COUNT`, `MISSION_ITEM_INT`, `MISSION_REQUEST_LIST`, `MISSION_ACK` in `lib/mavlink-serial.ts` or a new `lib/mavlink-mission.ts`.
- **Upload button**: sends the current mission to the connected drone over Web Serial. Shows progress (item N of M).
- **Download button**: reads the current mission from the drone and loads it into the editor.
- **Clear mission**: sends an empty mission to wipe the FC's mission store.
- **Validation**: warn if no takeoff item, if altitude is 0, or if the mission has no landing/RTL.

Out of scope: live tracking, flight mode changes.

---

## Stage 20 — Basic flight control

Give operators the minimum controls needed for daily ops, without exposing params.

- **Arm / Disarm button**: sends `COMMAND_LONG MAV_CMD_COMPONENT_ARM_DISARM`. Requires confirmation modal. Only enabled when drone is connected.
- **Mode selector**: read current flight mode from heartbeat, allow switching between configured modes (Stabilise, AltHold, Loiter, Auto, RTL). Show current mode prominently.
- **RTL button**: one-tap return to launch. Prominent, always visible when armed.
- **Connection status**: live heartbeat indicator — green when receiving heartbeats, red when link lost.
- **No param editing** on this page — params are read-only status display only.

Out of scope: video feed, telemetry graphs, full GCS feature parity.

---

## Stage 21 — Param locking for clients

Enforce the regulatory param lock at the app level so clients literally cannot change protected params, even if they know about the compare/edit flow.

- **Client role enforcement**: when `role === "client"`, the compare table's write mode button is hidden entirely — clients see params read-only.
- **Locked params list** (already exists as `data/locked-params.json`) extended with all regulatory params: motor limits, geofence settings, failsafe thresholds, ESC calibration params.
- **Admin "push update" flow**: admin prepares a new catalog version with the updated locked params, marks it. Client sees "Update available" and can apply it — but cannot inspect or override the locked values.
- **Audit log** (optional): record when a client applied an update, timestamp + version.

---

## Decisions

| Question | Decision |
|---|---|
| Map library | Leaflet (mature, well-supported in Next.js, no API key needed for OSM) |
| Mission format | MAVLink `MISSION_ITEM_INT` (integer lat/lon, avoids float precision issues) |
| Client GCS entry point | New `/mission` page, linked from the catalog home for client users |
| Param locking enforcement | Role-based at UI level + locked-params.json for specific params |
| Flight control scope | Arm/disarm + mode + RTL only — no autopilot tuning exposed |

---

## Out of scope

- Video feed / FPV
- Telemetry graphs / HUD
- Firmware flashing (use Mission Planner for initial setup)
- Two-way voice comms
- Multi-drone simultaneous control
