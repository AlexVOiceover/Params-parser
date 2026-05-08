# 09 Orphan Drone Default Tracking

> Make drones without a client_set ("orphans") track the Default param set for version comparisons and update notifications. Also ship the compare page back-navigation that was already coded in the previous session.

## Tasks

1. [ ] **Compare page back-navigation (already coded, commit it)**
   - [ ] 1.1 `lib/types.ts`: `CompareVersion` already has `familySlug`, `variantId`, `clientSetId` added — verify and commit.
   - [ ] 1.2 `app/(app)/compare/page.tsx`: breadcrumb back-link already coded — verify it builds, then commit.

2. [ ] **Extend /api/drone/match — orphan fallback**
   - [ ] 2.1 In `app/api/drone/match/route.ts`, when `clientSet` is null, look up the Default `client_set` for the drone's variant (`is_default=true`). Use it to fetch `catalog_version` and `latest_version_id` the same way as for registered drones.
   - [ ] 2.2 Add `is_orphan: boolean` to the response payload — `true` when the client_set lookup was null and we fell back to the Default.

3. [ ] **Extend hook and types**
   - [ ] 3.1 Add `is_orphan: boolean` to `MatchedDrone` interface in `lib/use-connected-drone-match.ts`.
   - [ ] 3.2 Expose `isOrphan: boolean` on `DroneMatchResult` (derive from `drone.is_orphan ?? false`).

4. [ ] **Import modal recap — orphan display**
   - [ ] 4.1 In `components/connect-drone-dialog.tsx`, when `match.isOrphan`, replace the "Client" row with "No client assigned" (muted text). Version status still shows normally.

5. [ ] **Variant page — Default card highlighted for orphan drones**
   - [ ] 5.1 In `components/client-set-list.tsx`, add an `isOrphanDrone` computed value: `match.isOrphan && connectedDroneId !== null`. When true, apply the emerald "your drone" highlight + badge to the Default card instead of a client card.
   - [ ] 5.2 Also apply the amber "Update available" badge to the Default card when `isOrphanDrone && match.versionStatus === "update_available"`.
   - [ ] 5.3 Ensure the "Apply update" button on the Default card's version list page works for orphan drones (it should already since `ApplyUpdateButton` just needs a `versionId`).

6. [ ] **Catalog home banner — orphan drones**
   - [ ] 6.1 In `components/drone-status-banner.tsx`, `isOrphan` drones should show "No client assigned" in the Client position. The version status strip and Apply update button already work through `match.versionStatus` and `drone.latest_version_id`, so no structural change needed — just verify the banner renders correctly for orphans.

7. [ ] **Typecheck + build**
   - [ ] 7.1 Run `npx tsc --noEmit` — fix any type errors.
   - [ ] 7.2 Run `npm run build` — confirm clean build.

8. [ ] **Changelog + version bump**
   - [ ] 8.1 Add v0.10.0 entry to `lib/changelog.ts`.

## Notes

- Default `client_set` lookup: `SELECT id FROM client_sets WHERE variant_id = <drone.variant_id> AND is_default = true LIMIT 1`. At most one per variant (partial unique index from feature 04).
- No RLS changes needed — the Default `client_set` is readable by all authenticated users via the existing `is_default` branch of `client_sets_select`.
- `connectedDroneId` in `client-set-list.tsx` is `match.drone?.id`. For orphans this won't match any card's `droneId`, so the Default card won't be highlighted by the existing path. The `isOrphan` flag adds a separate highlight path for the Default card specifically.
- The compare page back-link work was done in the last session (uncommitted). Task 1 just validates and commits it.
