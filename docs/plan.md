# 08 Update notifications

> When a connected drone has SCR_USER2 set, compare it against the catalog's latest version for that drone's client_set and surface the result in the import modal and on the variant page card. No drone writes; pure read-only notification.

## Tasks

1. [x] **Extend /api/drone/match to return version info**
   - [ ] 1.1 Accept an optional `?scr_user2=<int>` query param and echo it back as `drone_version: number | null` in the response.
   - [ ] 1.2 After matching the drone, find its `client_set` via `drone_id = matched_drone.id` + `variant_id = matched_drone.variant_id`. Fetch the `param_versions` row where `is_latest = true` for that client_set and return its version label as `catalog_version: number | null`. If no client_set or no versions exist, return `null`.
   - [ ] 1.3 Add `catalog_version` and `drone_version` to the `MatchedDrone` interface in `lib/use-connected-drone-match.ts`.

2. [x] **Extend useConnectedDroneMatch hook**
   - [ ] 2.1 Read `SCR_USER2` from `droneParams` alongside `SCR_USER1`. Parse it as an integer (`droneVersion`).
   - [ ] 2.2 Pass `scr_user2=<droneVersion>` as a query param when calling `/api/drone/match` (only when SCR_USER2 is a valid integer).
   - [ ] 2.3 Compute `versionStatus: 'up_to_date' | 'update_available' | 'drone_ahead' | 'unknown'` from `catalog_version` and `drone_version`: `unknown` when either is null; `update_available` when drone < catalog; `up_to_date` when equal; `drone_ahead` when drone > catalog.
   - [ ] 2.4 Expose `versionStatus`, `droneVersion`, and `catalogVersion` on the `DroneMatchResult` type.
   - [ ] 2.5 Bust the in-memory cache when SCR_USER2 changes (include `droneVersion` in the cache key alongside the SCR_USER1 integer).

3. [x] **Import modal: version status in the recap block**
   - [ ] 3.1 In `components/connect-drone-dialog.tsx`, in the "Drone identified" recap block, add a version status line after the Catalog row. Use `useConnectedDroneMatch()` which is already called in the component.
   - [ ] 3.2 Render per status: `up_to_date` → small green text "Version N — up to date"; `update_available` → amber callout "Update available — catalog is vN, drone has vN"; `drone_ahead` → blue callout "Drone has vN, catalog latest is vN"; `unknown` or `loading` → nothing extra.

4. [x] **Variant page: Update available badge on matching card**
   - [ ] 4.1 In `components/client-set-list.tsx`, in `renderCard`, after the existing "this drone" badge, add a pulsing amber "Update available" badge when `isConnected && versionStatus === 'update_available'`. Use `animate-pulse` on the badge span. Match the existing badge style but in amber.

5. [x] **Smoke test (manual)** — verified by user throughout implementation.

6. [x] **Changelog + version bump**
   - [x] 6.1 v0.9.0 added.

## Notes

- `catalog_version` lookup: `SELECT client_set_id, version_label FROM param_versions WHERE is_latest = true AND client_set_id IN (SELECT id FROM client_sets WHERE drone_id = <matched_drone_id> AND variant_id = <matched_drone_variant_id>)`. There should be at most one result since a drone can only have one client_set per variant.
- If the drone has no client_set yet (brand new, no uploads), `catalog_version = null` → status `unknown`. No badge, no callout.
- The cache map key was `SCR_USER1 integer`. Change it to a composite string `"${scr1}_${scr2}"` so a version change on the same drone busts the cache.
- No DB schema changes in this stage.
