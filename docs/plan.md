# 18 Mission Planning UI

> New /mission page with an interactive map for creating and editing waypoint missions. No drone connection required — missions are persisted locally.

## Tasks

1. [ ] **Install dependencies**
   - [ ] 1.1 Run `npm install leaflet react-leaflet @types/leaflet`

2. [ ] **Create mission page**
   - [ ] 2.1 Create `app/(app)/mission/page.tsx` — redirect if not authenticated
   - [ ] 2.2 Create `components/mission/mission-map.tsx` — client component with dynamic import (SSR disabled) wrapping the Leaflet map
   - [ ] 2.3 Map fills available height with OSM tile layer; click to add waypoint markers

3. [ ] **Waypoint data model and localStorage**
   - [ ] 3.1 Define `Waypoint` type: `{ id, seq, lat, lon, alt, action }`; `action` is one of `"waypoint" | "takeoff" | "land" | "rtl" | "loiter"`
   - [ ] 3.2 `useMission` hook in `lib/use-mission.ts` — manages waypoints array, persists to/from localStorage automatically

4. [ ] **Map interactions**
   - [ ] 4.1 Click map → add waypoint at clicked lat/lon with default alt 30m
   - [ ] 4.2 Render numbered markers for each waypoint; draw a polyline connecting them in sequence
   - [ ] 4.3 Drag marker → update lat/lon in mission state

5. [ ] **Waypoint sidebar**
   - [ ] 5.1 Scrollable list alongside map: each row shows seq #, action icon, altitude (editable input), delete button
   - [ ] 5.2 Up/down arrows to reorder waypoints (renumbers seq)
   - [ ] 5.3 Click row → highlight/pan to that marker on map
   - [ ] 5.4 "Clear all" button to wipe mission

6. [ ] **Navigation link**
   - [ ] 6.1 Add "Mission" link to the catalog home toolbar (`app/(app)/page.tsx`) alongside Compare and Filter
   - [ ] 6.2 Use `Map` icon from lucide-react; icon-only on mobile, icon+text on sm+

7. [ ] **Typecheck**
   - [ ] 7.1 `npx tsc --noEmit` — fix any errors

## Notes

- Leaflet requires `import 'leaflet/dist/leaflet.css'` and the map component must be dynamically imported with `{ ssr: false }` — Next.js SSR breaks Leaflet
- Default marker icons in react-leaflet are broken without a workaround: set `L.Icon.Default.mergeOptions({ iconUrl, shadowUrl })` manually or use a custom DivIcon
- The map container needs an explicit height — use `h-full` with a flex parent
- `useMission` should expose: `waypoints`, `addWaypoint(lat, lon)`, `updateWaypoint(id, patch)`, `removeWaypoint(id)`, `moveUp(id)`, `moveDown(id)`, `clearAll`
