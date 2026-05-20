# 18 — Map + Mission Planning UI

A new `/mission` page where clients and admins can create and edit waypoint missions visually on a map. No param access on this page — purely for mission planning. Missions are persisted in localStorage so they survive page refreshes.

## Scope

- **Dependencies**: install `leaflet` and `react-leaflet` (and `@types/leaflet`)
- **New page** `app/(app)/mission/page.tsx` — client component (map requires browser APIs), accessible to all authenticated users
- **Map**: Leaflet map with OSM tile layer, fills the page. Satellite/street toggle optional but nice.
- **Add waypoints**: click the map to add a waypoint marker. Each waypoint has: sequence number, lat/lon, altitude (default 30m, editable), and optional action (none / takeoff / land / RTL / loiter).
- **Waypoint list sidebar**: scrollable list alongside the map showing all waypoints in order. Each row shows: #, action icon, altitude. Click to select/highlight on map. Delete button per row.
- **Drag to reposition**: waypoint markers are draggable on the map, updating lat/lon.
- **Reorder**: up/down arrows in the sidebar list to change waypoint sequence.
- **Clear all**: button to wipe the current mission.
- **LocalStorage persistence**: save/load mission JSON automatically. Mission survives page reload.
- **Navigation link**: add "Mission" to the main header nav (visible to all roles).
- **DB**: no schema changes — missions are local only at this stage.

## Out of Scope for This Stage

- Uploading the mission to a drone (Stage 19)
- Downloading a mission from a drone (Stage 19)
- Flight mode control / arm / disarm (Stage 20)
- Param access or editing on this page
- Multiple saved missions (single active mission only)
- 3D altitude visualisation
