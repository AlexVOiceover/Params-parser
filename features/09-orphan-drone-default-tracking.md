# 09 — Orphan Drone Default Tracking

Drones with no `client_set` ("orphan drones") currently get `versionStatus=unknown` because the match endpoint derives `catalog_version` from the drone's `client_set`, which doesn't exist. This stage makes orphan drones track the Default param set for their variant — they get "Update available" notifications when the Default advances, and the variant page highlights the Default card as "your drone" rather than showing nothing.

## Scope

- **`/api/drone/match` extension**: when `clientSet` is null (no `client_set` row matching `drone_id + variant_id`), fall back to looking up the Default `client_set` for the variant (`is_default=true`). Use that Default's `latest_version_id` and `catalog_version`. Add `is_orphan: boolean` to the response so the UI can branch on it.

- **`MatchedDrone` type + hook**: add `is_orphan: boolean` field to `MatchedDrone` in `lib/use-connected-drone-match.ts`. Expose `isOrphan` on the `DroneMatchResult` type.

- **Import modal recap** (`components/connect-drone-dialog.tsx`): for orphan drones, replace the "Client" row with "No client assigned". Version status line still works normally (up to date / update available against the Default).

- **Catalog home banner** (`components/drone-status-banner.tsx`): orphan drones with `update_available` show the amber "v1 → v2" strip and Apply update button targeting the Default's latest version.

- **Variant page client_set cards** (`components/client-set-list.tsx`): for orphan drones, highlight the Default card with the emerald "your drone" badge (instead of a client card). The "Update available" badge also appears on the Default card when the drone is behind.

- **Apply update for orphans**: `ApplyUpdateButton` already works with any `versionId` — no changes needed there. The Default's `latest_version_id` from the match response is passed through as the target.

- **No DB changes**: purely a change to how the match endpoint resolves `catalog_version` and how the UI uses it.

## Out of Scope for This Stage

- The Register drone wizard (Stage 10) — orphan drones can exist via existing drone registration in `/admin/clients`.
- Variant page URL routing changes.
- Any changes to client_set or Default creation flows.
- The `client_sets` table rename (deferred to a cleanup sprint per PLAN.md decision).

## Notes

- The Default `client_set` lookup: `SELECT id FROM client_sets WHERE variant_id = <drone.variant_id> AND is_default = true`. There is at most one per variant (enforced by the partial unique index added in feature 04).
- The existing `client_sets_select` RLS policy allows orphan drones to query the Default (the `is_default` branch of the policy is accessible to all authenticated users). No RLS changes needed.
- `ApplyUpdateButton` calls `clearDroneMatchCache()` on success — this already works for orphans since the cache key is `SCR_USER1_SCR_USER2`.
- On the variant page, the `connectedDroneId` used in `renderCard` comes from `match.drone?.id`. For orphan drones this is still the drone's id; it just won't match any client_set's `droneId`. So the Default card won't be highlighted by the existing logic. The new `isOrphan` flag is needed to add a separate highlight path for the Default card.
