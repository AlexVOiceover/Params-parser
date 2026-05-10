# 12 Param Sanity Check

> When a drone's version matches the catalog, compare actual param values in the background. Surface "up_to_date_modified" if values differ — catching post-flash changes made via Mission Planner or any other GCS.

## Tasks

1. [x] **Extract RUNTIME_PARAMS to shared lib**
   - [ ] 1.1 Move the `RUNTIME_PARAMS` set from `components/apply-update-button.tsx` to `lib/param-engine.ts` as a named export. Update the import in `apply-update-button.tsx`.

2. [x] **Extend /api/drone/match — drift detection**
   - [ ] 2.1 Accept an optional `&params=<base64>` query param. Decode it as `JSON.parse(Buffer.from(params, "base64").toString("utf-8"))` → `Record<string, string>`. Return `drone.drift_count = null` when no params sent.
   - [ ] 2.2 When `droneVersion === catalogVersion` AND decoded params are present, fetch `param_values` for `resolvedClientSet.id` (paginated). Diff decoded params vs fetched values: for each name in the catalog version, skip names in `RUNTIME_PARAMS`, skip `SCR_USER1`/`SCR_USER2`; count names where string values differ. Set `drift_count = diffCount`.
   - [ ] 2.3 Add `drift_count: number | null` to the JSON response and to the `MatchedDrone` interface in `lib/use-connected-drone-match.ts`.

3. [x] **Extend useConnectedDroneMatch hook**
   - [ ] 3.1 Add `"up_to_date_modified"` to the `VersionStatus` type.
   - [ ] 3.2 When `droneParams` is available and non-empty, build the base64 param payload: `btoa(unescape(encodeURIComponent(JSON.stringify(Object.fromEntries(droneParams.map(p => [p.name, p.value]))))))`. Append `&params=<encoded>` to the fetch URL.
   - [ ] 3.3 Update `computeVersionStatus` to return `"up_to_date_modified"` when `drone.drift_count !== null && drone.drift_count > 0` and the existing status would be `"up_to_date"`.
   - [ ] 3.4 Expose `driftCount: number | null` on `DroneMatchResult` (from `drone.drift_count ?? null`).
   - [ ] 3.5 **Cache**: always bypass the cache when `droneParams` is present — never return a stale cached result when the drone's actual params may have changed between imports. Do this by appending the param payload to the cache key, or simply skipping cache lookup when `droneParams` is non-null.

4. [x] **Import modal recap**
   - [ ] 4.1 In `components/connect-drone-dialog.tsx`, replace the green "up to date" line with amber "v{N} — {driftCount} params differ from catalog" when `versionStatus === "up_to_date_modified"`. Include a Compare link: `/compare?v=__drone__&v=<match.drone.latest_version_id>`.
   - [ ] 4.2 Keep the existing "up to date" green line for `versionStatus === "up_to_date"` (no drift).

5. [x] **Variant page client_set card**
   - [ ] 5.1 In `components/client-set-list.tsx`, in `renderCard`, add an `isModified` computed value: `isConnected && match.versionStatus === "up_to_date_modified"`.
   - [ ] 5.2 Show an amber pulsing "Modified" badge next to the version info when `isModified`. Style matches the existing "Update available" badge but uses "Modified" label.
   - [ ] 5.3 Add a small "Review" link to `/compare?v=__drone__&v=<c.latestVersionId>` when `isModified` — same position as other action links (before the icons).

6. [x] **Drone status banner**
   - [ ] 6.1 In `components/drone-status-banner.tsx`, add a case for `versionStatus === "up_to_date_modified"`: show amber text "v{N} — {driftCount} params modified" and a Review link to `/compare?v=__drone__&v=<drone.latest_version_id>`.

7. [x] **Typecheck + build**
   - [ ] 7.1 `npx tsc --noEmit` — fix any errors.
   - [ ] 7.2 `npm run build` — confirm clean.

8. [x] **Changelog + version bump**
   - [ ] 8.1 Add v0.13.0 entry to `lib/changelog.ts`.

## Notes

- `RUNTIME_PARAMS` must be available in the API route — move to `lib/param-engine.ts` in task 1.
- The base64 encoding in the browser: `btoa(unescape(encodeURIComponent(json)))` handles Unicode safely. Server decoding: `Buffer.from(b64, "base64").toString("utf-8")`.
- Cache bypass in task 3.5: simplest approach is to add the param payload length (not the full encoded string) to the cache key, e.g. `"${scr1}_${scr2}_${droneParams?.length ?? 0}"`. This busts when the param count changes (e.g. after a flash) without encoding the full 20KB in the key. Full re-fetch on every import is also acceptable — the match request is cheap.
- The drift diff only runs when `droneVersion === catalogVersion`. For `update_available` and `drone_ahead` cases, the existing logic is unchanged.
- `latest_version_id` is already on `match.drone` (added in feature 08) — use it for the Compare link.
- The `resolvedClientSet` variable in the match route already handles both registered and orphan drones — the drift check reuses the same variable.
