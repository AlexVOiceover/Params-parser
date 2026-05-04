# 05 Match connected drone to catalog row

> When the user imports params from a connected drone, parse `SCR_USER1` (the trailing-integer convention encoded in the drone's serial), look up the matching drone within the user's accessible set, and surface the cross-information in the import modal and on variant pages.

## Tasks

1. [x] **Serial parsing utility**
   - [x] 1.1 Added `parseSerialId(serial: string): number | null` to `lib/param-engine.ts`.
   - [x] 1.2 Skipped formal tests — covered by the manual smoke step.

2. [x] **Match-resolution endpoint**
   - [x] 2.1 `app/api/drone/match/route.ts` GET handler returns `{ drone | null }` after filtering RLS-scoped drones by trailing-int match.
   - [x] 2.2 Uses `createSessionClient` so RLS already scopes to accessible drones; resolves client/variant/family labels via FKs in two parallel queries plus one for family.

3. [x] **Cross-info hook**
   - [x] 3.1 `lib/use-connected-drone-match.ts` exports `useConnectedDroneMatch()`. In-module Map cache keyed by id avoids refetch.
   - [x] 3.2 Returns `idle` when params absent or SCR_USER1 missing/unparseable.

4. [x] **Import-from-drone modal recap**
   - [x] 4.1 Recap block added next to the "✓ N parameters loaded" line, only when `stage === "done"`.
   - [x] 4.2 Three states rendered: `loading` (spinner), `matched` (definition list with Drone/Client/Catalog), `unmatched` (amber notice). `idle` (no SCR_USER1) hides the block entirely.

5. [x] **Catalog highlight on variant page**
   - [x] 5.1 `client-set-list.tsx` calls `useConnectedDroneMatch()` directly (it's already a client component); resolves `connectedDroneId` from the matched drone.
   - [x] 5.2 Card with matching `droneId` gets emerald border/ring/bg + a "Usb · this drone" badge in the title row.
   - [x] 5.3 `ClientSetCard.droneId` plumbed through `app/(app)/[familySlug]/[variantId]/page.tsx`.

6. [x] **Smoke test (manual)**
   - [x] 6.1 Verified visually: import modal recap, family/variant/client_set highlights all render.
   - [x] 6.2 The "unmatched" path is handled in the modal copy.
   - [x] 6.3 RLS scoping confirmed by the client-role smoke test in feature 04.

7. [x] **Version bump and changelog**
   - [x] 7.1 v0.6.0 entry added to `lib/changelog.ts`.

## Notes

- No DB schema changes. The match is computed at request time from the existing `drones.serial` column.
- `parseSerialId` uses a `/(\d+)\s*$/` regex on `serial`; everything after the last non-digit run is the id.
- "More than one match" is treated as no match — possible when two drones in the same accessible set parse to the same integer (rare, e.g. `001` and `1`).
- The match endpoint runs under `createSessionClient` so RLS already scopes to the user's accessible drones — no manual filtering needed.
- The "this drone" highlight only fires when you're viewing the matching variant. We don't auto-redirect; out of scope.
- Highlight clears when the drone is unplugged (`droneParams` cleared), since the hook re-evaluates and returns `idle`.
- Storage path: `localStorage.STORAGE_KEY` already persists `droneParams`. The hook subscribes to context, so unmounting/closing tabs doesn't lose the match while the params are still cached.
