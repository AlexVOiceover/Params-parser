# 12 — Param Sanity Check (version matches but values differ)

When a connected drone's `SCR_USER2` matches the catalog's latest version, the app currently shows "up to date" and stops. This stage adds a background param-level comparison: if the drone's actual values differ from what's stored in the catalog (e.g. someone changed params in Mission Planner after the last flash), surface a new `"up_to_date_modified"` status with an amber badge and a Review link. Read-only notification only — no auto-action.

## Scope

- **`/api/drone/match` extension**: accept a new optional query param `&params=<base64-json>` containing the drone's current param values as `{"NAME": "value"}`. When `droneVersion === catalogVersion`, fetch the catalog version's `param_values` (paginated), diff against the received params (string comparison, excluding `STAT_*`, `SCR_USER1`, `SCR_USER2`, and the existing `RUNTIME_PARAMS` set), and return `drift_count: number | null` alongside the existing fields. `null` when no params were sent.

- **`useConnectedDroneMatch` hook** (`lib/use-connected-drone-match.ts`): when `droneParams` is available in context, build a base64-encoded JSON map of `{name: value}` and append `&params=<base64>` to the match request URL. Expose `driftCount: number | null` on `DroneMatchResult`. Set `versionStatus = "up_to_date_modified"` when `driftCount !== null && driftCount > 0`. Cache key must include the encoded params so a param change on the drone busts the cache.

- **`VersionStatus` type** (`lib/use-connected-drone-match.ts`): add `"up_to_date_modified"` to the union.

- **`MatchedDrone` type**: add `drift_count: number | null`.

- **Import modal recap** (`components/connect-drone-dialog.tsx`): when `versionStatus === "up_to_date_modified"`, replace the green "up to date" line with an amber row: "v{N} — {driftCount} param{s} differ from catalog". Include a Compare link to `/compare?v=__drone__&v=<latestVersionId>`.

- **Variant page client_set card** (`components/client-set-list.tsx`): when `isConnected && versionStatus === "up_to_date_modified"`, show an amber pulsing "Modified" badge (similar style to "Update available" but different wording). Add a small "Review" link to `/compare?v=__drone__&v=<latestVersionId>` alongside the other action links.

- **Drone status banner** (`components/drone-status-banner.tsx`): for `up_to_date_modified`, show "v{N} — {driftCount} params modified" amber text and a Review link instead of the green "up to date" text.

- **DB**: no schema changes.

- **Changelog + version**: v0.13.0.

## Out of Scope for This Stage

- Any write action (restore / re-flash) — the admin uses the existing "Apply update" flow to re-flash the same version if they want to restore. This stage is notification only.
- Capturing the modified params as a new version (Stage 13 — "Needs review").
- Float tolerance comparison — string comparison is sufficient; a few float-formatting false positives are harmless (they prompt a review).
- Showing the full list of differing param names in the banner or card — just the count. The Compare page shows the details.
- Changing the orphan drone flow — orphans compare against the Default's latest version, same logic as today.

## Notes

- **Encoding**: `JSON.stringify({name: value, ...})` → `btoa(unescape(encodeURIComponent(json)))` in the hook. On the server: `Buffer.from(params, "base64").toString("utf-8")` → `JSON.parse`. Limit: URL query strings support up to ~8KB safely; a 1000-param set encoded as base64 JSON is ~20KB. Use a POST body instead if the URL length is a concern — but in practice `GET` with a long query string works fine on modern infra.
- **Cache key change**: the current cache key is `"${scr1}_${scr2}"`. With drift detection, the same drone (same SCR_USER1/2) could have different params if the user changed something and re-imported. The cache should be invalidated whenever `droneParams` changes (already happens because `lastKeyRef` compares the cache key, but the *encoded params* should be part of the key or the cache should always be bypassed when `droneParams` changes). Simplest fix: don't cache results when `droneParams` is present — always re-fetch. The request is cheap (the heavy work is the param_values fetch on the server, which is already paginated).
- **Performance**: the server diff adds ~200-400ms to the match request when drone params are present. The hook already shows a "loading" state while this happens, so the UX is unaffected.
- **The existing `computeVersionStatus` function** will need to handle `drift_count` from the server response to set `"up_to_date_modified"` correctly.
