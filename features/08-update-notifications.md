# 08 — Update notifications (read-only, no drone writes)

When a drone is connected, compare its `SCR_USER2` (self-reported version integer) against the catalog's latest version for that drone's client_set. Surface the result — up to date, update available, or drone ahead — in the import modal recap and on the variant page client_set card. No writes to the drone in this stage.

## Scope

- **`/api/drone/match` extension**: after resolving the matched drone, also look up the drone's `client_set` on this variant (matched via `drone_id`), fetch its `latest` `param_version`, and return:
  - `catalog_version: number | null` — the integer version of the latest catalog entry for this drone's client_set (null if no versions).
  - `drone_version: number | null` — parsed from the `SCR_USER2` param in the connected drone params (the caller will send this; add `?scr_user2=<int>` as an optional query param so the API can echo it back in the response alongside the catalog version, which allows the client to derive `versionStatus` without a second round-trip).

  **Response shape addition:**
  ```ts
  {
    drone: { ...existing fields..., catalog_version: number | null, drone_version: number | null }
  }
  ```

- **`useConnectedDroneMatch` hook extension**: 
  - Read `SCR_USER2` from `droneParams` alongside `SCR_USER1`.
  - Pass `scr_user2` as a query param to `/api/drone/match`.
  - Expose two new fields on the result:
    ```ts
    versionStatus: 'up_to_date' | 'update_available' | 'drone_ahead' | 'unknown'
    droneVersion: number | null
    catalogVersion: number | null
    ```
  - `unknown` when `SCR_USER2` is missing or not a parseable integer, OR when no client_set/version exists in the catalog.

- **Import modal recap** (`components/connect-drone-dialog.tsx`): extend the "Drone identified" block added in feature 05:
  - `up_to_date` → small green line: *"Version 3 — up to date"*
  - `update_available` → amber callout: *"Update available — catalog is v3, drone has v2"*
  - `drone_ahead` → blue callout: *"Drone has v5, catalog latest is v3"*
  - `unknown` → no version line (same as today)

- **Variant page client_set card** (`components/client-set-list.tsx`): when the connected drone matches a card (`droneId === connectedDroneId`) and `versionStatus === 'update_available'`, add a pulsing amber badge *"Update available"* next to the existing "this drone" badge.

- **Changelog + version**: v0.9.0.

## Out of Scope for This Stage

- Writing params to the drone (Stage 10–11).
- "Capture from drone" button or `needs_review` flag (Stage 09).
- Admin alert badge for review queue (Stage 09).
- Any UI changes to the catalog home or family pages beyond the variant card badge.
- Handling the case where the drone has `SCR_USER2` but no matching `client_set` exists (treated as `unknown`).

## Notes

- The `catalog_version` lookup: find `client_sets` where `drone_id = matched_drone.id` and `variant_id = matched_drone.variant_id`, then get the `param_versions` row where `is_latest = true`. Take its `version_label` as an integer.
- If the drone has no client_set yet (brand new drone, no uploads), `catalog_version` is `null` → `unknown`. No badge, no callout.
- Cache key in `useConnectedDroneMatch` currently uses just the `SCR_USER1` integer. Extend it to also depend on `SCR_USER2` (or just bust the cache whenever `droneParams` changes — the cache is in-memory per session anyway).
- The pulsing amber badge: Tailwind `animate-pulse` on the badge span. Same style as the "this drone" emerald badge but in amber.
