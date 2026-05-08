# 10 Register Drone Wizard

> A multi-step modal triggered when `SCR_USER2=0` (unversioned drone). Walks the user through serial/family/variant/client, confirms, then creates DB records and flashes the Default param set to the drone.

## Tasks

1. [x] **New API: POST /api/admin/drones**
   - [ ] 1.1 Create `app/api/admin/drones/route.ts` with a POST handler. Accepts `{ serial, variantId, clientId? }`. Validates role (admin/contributor). Creates a `drones` row with `client_id=null` if no client. Returns `{ ok: true, id }`. Reuse the existing client check pattern from `app/api/admin/clients/[id]/drones/route.ts`.
   - [ ] 1.2 Guard against duplicate serials per client (or globally if no client) — return a 409 with a friendly message if the serial already exists for that client.

2. [x] **RegisterDroneModal component**
   - [ ] 2.1 Create `components/register-drone-modal.tsx`. Props: `onClose: () => void`. Internal stages: `"form" | "confirm" | "flashing" | "done" | "error"`. Style matches `ConnectDroneDialog`.
   - [ ] 2.2 **Form step**: derive initial values from `droneParams` context (`SCR_USER1` for serial, `SCR_USER2` to confirm it's 0). Fetch families + variants + clients on mount. Show serial (locked if `SCR_USER1>0`), family dropdown, variant dropdown (filtered), client dropdown ("No client (orphan)" as default first option).
   - [ ] 2.3 **Case detection** inside the form: if `SCR_USER1>0`, call `/api/drone/match?id=<serial>` to check if drone is already in DB. If found → lock family/variant fields and show "already registered" info. If not found → allow family/variant selection.
   - [ ] 2.4 **Confirm step**: summary card showing serial, family/variant, client (or "Orphan — will track Default"), Default version to flash. "Register & Flash" CTA + Back button.
   - [ ] 2.5 **Flash step**: sequentially: (a) create drone row via `POST /api/admin/drones`, (b) create `client_set` via `POST /api/admin/client-sets` only if client selected, (c) fetch Default latest `param_version` for the variant, (d) open `WriteDroneDialog` with diff params (Default params vs current drone params). Show a progress log.
   - [ ] 2.6 **Done/error step**: success shows "Drone registered as [serial] — v1 flashed". Error shows what failed with a retry option.

3. [x] **Trigger: connect-drone-dialog**
   - [ ] 3.1 In `components/connect-drone-dialog.tsx`, after stage `"done"`, check if `SCR_USER2=0` in the imported params. If so, show a "Register this drone" button in the recap block (above the version status line).
   - [ ] 3.2 Clicking opens `RegisterDroneModal` over the connect dialog (z-index stacked). Closing the register modal returns to the connect dialog done state.

4. [x] **Trigger: drone-status-banner**
   - [ ] 4.1 In `components/drone-status-banner.tsx`, when `match.status === "unmatched"` (drone not in DB at all) OR (`match.isOrphan && match.versionStatus === "unknown"` meaning no Default either), show a "Register" amber button alongside the existing content.
   - [ ] 4.2 When `SCR_USER2=0` and matched as orphan with a Default, show "Register" button (the drone is in the DB but unversioned — still needs the flash).

5. [x] **Default param lookup helper**
   - [ ] 5.1 Add a small helper function (or inline in the modal) that fetches the Default `param_version` for a given `variantId`: query `client_sets WHERE variant_id=X AND is_default=true`, then `param_versions WHERE client_set_id=Y AND is_latest=true`. Returns `{ versionId, versionLabel } | null`. Used in the flash step to know what to write.

6. [x] **Locked field UX**
   - [ ] 6.1 When family/variant are locked (drone already in DB), render them as greyed-out text with a `title="Cannot change — edit in Clients & Drones"` tooltip rather than as disabled selects, to make the locked state visually clear.

7. [x] **WriteDroneDialog integration**
   - [ ] 7.1 The flash step (2.5c-d) fetches the Default's `param_values` (paginated) and diffs against current `droneParams`. Pass the diff to `WriteDroneDialog`. On success from the dialog, update `droneParams` context with the written values (same pattern as `ApplyUpdateButton.handleSuccess`). Call `clearDroneMatchCache()` afterward.

8. [x] **Typecheck + build**
   - [ ] 8.1 `npx tsc --noEmit` — fix any errors.
   - [ ] 8.2 `npm run build` — confirm clean.

9. [x] **Changelog + version bump**
   - [ ] 9.1 Add v0.11.0 entry to `lib/changelog.ts`.

## Notes

- No new DB tables. Uses existing `drones`, `client_sets`, `param_versions`.
- The existing `POST /api/admin/clients/[clientId]/drones` requires a clientId in the URL. For orphan registration (no client), we need the new `POST /api/admin/drones` route that makes `clientId` optional.
- `WriteDroneDialog` needs `changes: WriteChange[]` — derive from diff of Default param_values vs current droneParams. Same logic as `ApplyUpdateButton`.
- `clearDroneMatchCache()` and `router.refresh()` after successful registration ensure the UI re-evaluates the drone state.
- If no Default exists for the selected variant, the flash step should surface an error: "No Default param set found — upload one first." before trying to flash.
- The `SCR_USER1` write is included in the diff if the drone's current `SCR_USER1` doesn't match the trailing int of the chosen serial.
