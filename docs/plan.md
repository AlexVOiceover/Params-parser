# 20 Chip-ID Identity and Desired-State Config

> Replace `SCR_USER1` / `SCR_USER2` identity and versioning with the FC's hardware chip ID (linked to a drone record by staff) and a direct comparison between a drone's live params and the latest approved version in its history. Writes are verified by read-back and recorded in an append-only event log.

## Tasks

1. [x] **Database**
   - [x] 1.1 Migration: `drones.chip_id text UNIQUE NULL`, `param_versions.firmware text NULL`.
   - [x] 1.2 Migration: `drone_events (id, drone_id, param_version_id NULL, chip_id, firmware, kind, diff_count, method NULL, created_by, created_at)`. `kind` CHECK in (`applied`, `captured`, `linked`, `relinked`, `unlinked`); `method` CHECK in (`connect`, `messages_line`, `assembly`).
   - [x] 1.3 RLS on `drone_events`: SELECT for users who can see the drone; INSERT of link kinds for admin/contributor only (`current_role()`), `applied` / `captured` for anyone who can see the drone; no UPDATE or DELETE policies.
   - [x] 1.4 Apply with `npx supabase db push` and update the TypeScript types in `lib/types.ts`.

2. [x] **Shared comparison rules**
   - [x] 2.1 `data/unmanaged-params.json` in the `prefix` / `exact` rule format, seeded from the Calibration and Hardware & Device IDs protection lists plus `data/volatile-params.json`.
   - [x] 2.2 `lib/desired-state.ts`: `isUnmanaged(name)`, `paramsEqual(a, b)` (same `Math.fround`, or relative difference ≤ 1e-6), and `diffDesired(desired, actual)` → `{ name, desired, actual | null }[]` (missing on drone counts; extra on drone is ignored; unmanaged skipped). Explicit return types, no `any`.
   - [x] 2.3 `parseChipIdInput(text)`: accepts a 24-hex chip ID or a Mission Planner Messages line (`CubeOrangePlus 00320021 3438510B 36373832`), reverses each 4-byte group of the line into `uid2` order, returns the normalised chip ID or `null`. Check it against the chip ID the modal showed for a real drone.

3. [x] **Protocol layer (`lib/mavlink-serial.ts`)**
   - [x] 3.1 Parse `flight_sw_version` from `AUTOPILOT_VERSION` into `major.minor.patch`; report chip ID and firmware together via one `onAutopilotInfo` callback (replacing `onChipId`).
   - [x] 3.2 Write session: request `AUTOPILOT_VERSION` before the first `PARAM_SET` and refuse to write unless its chip ID equals the snapshot's. This replaces the fingerprint check.
   - [x] 3.3 Read-back verification: after writing, read every written param by name (`PARAM_REQUEST_READ`, index −1) and mark success only when `paramsEqual` holds. Remove "no echo — assumed written".

4. [x] **Snapshot carries hardware identity**
   - [x] 4.1 `lib/drone-params-context.tsx`: store `chipId` and `firmware` alongside the params from the connect read; clear them together on unplug, mismatch and Forget.
   - [x] 4.2 Remove `IDENTITY_PARAMS`, `rememberDroneIdentity`, `updateDroneIdentity` and the fingerprint helpers from `lib/drone-params-shared.ts`; the write guard reads the chip ID from the snapshot.

5. [x] **Match and status API**
   - [x] 5.1 Rewrite `/api/drone/match` as POST `{ chipId, firmware, params, scrUser1Hint }`. A linked chip returns the drone, client, family, variant, history (client set), desired version (latest with `needs_review = false`), any newer pending-review version, and the last `applied`/`captured` event.
   - [x] 5.2 Server-side state from `diffDesired`: `in_sync`, `update_available` (equals last logged version), `modified` (equals neither), `differs` (no event yet), `pending_review`; plus the diff list and a firmware-mismatch flag (major.minor).
   - [x] 5.3 An unknown chip returns `unlinked`; for staff it also returns the unlinked drone records with the `SCR_USER1`-matched one pre-selected and the rest ordered by diff count against their latest version.
   - [x] 5.4 Rewrite `lib/use-connected-drone-match.ts` around the new response (cache keyed by chip ID + params checksum), exposing state, diff list and firmware info.

6. [x] **Linking (staff only)**
   - [x] 6.1 API `POST /api/admin/drones/[id]/link` `{ chipId, method }`: admin/contributor only; refuses a chip already linked elsewhere; re-linking a drone that has a chip is admin-only (`relinked`); `DELETE` unlinks (`unlinked`). Each writes a `drone_events` row.
   - [x] 6.2 Connect modal, unknown chip, staff: "This flight controller isn't linked yet. Which drone is it?" picker with the pre-selection and ordering from 5.3, a reminder to check the serial label, and a `BusyButton` to link; re-runs the match when it succeeds.
   - [x] 6.3 Connect modal, unknown chip, client: "This drone isn't set up for updates yet — contact AIR6."
   - [x] 6.4 Admin drones page: chip ID column showing "Not linked"; a "Link flight controller" input accepting a chip ID or a Messages line (via `parseChipIdInput`), plus re-link and unlink actions.

7. [x] **Apply, verify and log**
   - [x] 7.1 API `POST /api/drone/events` for `applied` / `captured` (anyone who can see the drone), recording chip ID, firmware, version and diff count.
   - [x] 7.2 Apply flow: write the differing managed params → read-back verify → log `applied` only when the diff is empty; otherwise list the params that did not take.
   - [x] 7.3 Firmware mismatch: show "vN was made for X.Y, this drone runs A.B" and require an explicit confirmation before applying.
   - [x] 7.4 Point `ApplyUpdateButton` and the compare page's write path at the verified write (compare edits verify but do not log `applied`).

8. [x] **Status UI**
   - [x] 8.1 Connect modal: chip ID, serial, client, family, variant, firmware, state and diff list; for `update_available` it is the update popup, with Apply in it; `modified` / `differs` offer Restore vN.
   - [x] 8.2 Map the new states into `drone-status-banner`, `family-grid`, `variant-list`, `param-version-list` and `drone-identity-card`.

9. [x] **Save as new version (everyone)**
   - [x] 9.1 API to create the next version in the drone's history from the read, recording firmware: admin → approved; others → `needs_review = true`. Logs `captured`. Authorise against drone visibility server-side.
   - [x] 9.2 "Save as new version" button on `modified` / `differs` in the connect modal, replacing the drone-ahead capture button; `pending_review` shows "saved as vN, pending review".

10. [x] **Firmware on versions**
    - [x] 10.1 Optional firmware field in the upload form, catalog upload modal and upload-param-file modal; stored by `/api/upload`; clones inherit the source's firmware.
    - [x] 10.2 Show firmware ("unknown" when empty) on version rows.

11. [x] **Drone history shows the event log**
    - [x] 11.1 On the client-set page, list `drone_events` next to the versions: "v3 applied 2 Jun by Hansab · verified · 4.5.7", plus link events with their method.

12. [x] **New drone bring-up**
    - [x] 12.1 Register wizard: store the chip ID on the new drone and log `linked` (method `assembly`); stop writing `SCR_ENABLE`, `SCR_USER1` and `SCR_USER2`.
    - [x] 12.2 Apply the variant's Default minus unmanaged params → verify → save the result as v1 of the drone's history → log `captured`.

13. [x] **Remove the old model**
    - [x] 13.1 Remove `SCR_USER2` injection from `app/api/upload/route.ts`, `app/api/admin/param-versions/[id]/clone/route.ts` and `app/api/admin/param-versions/[id]/values/route.ts`.
    - [x] 13.2 Delete `app/api/drone/drift`, the `up_to_date_modified` / `drone_ahead` states, the drone-ahead capture flow and the `SCR_USER2` version-marker row in `write-drone-dialog.tsx`.
    - [x] 13.3 Sweep for remaining `SCR_USER1` / `SCR_USER2` logic; the only allowed use is the `SCR_USER1` pre-selection hint.

14. [x] **Verify**
    - [x] 14.1 `npx tsc --noEmit` and `npm run build` clean; a11y rules from CLAUDE.md (labels with `htmlFor`, `aria-label` on icon buttons); `loading.tsx` for any new data route; `BusyButton` on every async action.
    - [x] 14.2 Add a hardware test checklist to `TEST_PENDING.md`: link by connect, link by Messages line, update popup → apply → verified log, Mission Planner edit → modified, wrong drone → write refused, firmware mismatch warning, reboot-required param read-back.

## Notes

- **Spec**: `features/20-chip-id-desired-state.md`. Already done on this branch: the chip ID read (`AUTOPILOT_VERSION.uid2`) shown in the connect modal, verified on hardware.
- **Managed by default**: only params on `data/unmanaged-params.json` are excluded. Never add an entry just to silence a difference.
- **Staff only link**: admin and contributor. Clients never link; they see "contact AIR6".
- **`SCR_USER1` is a hint only** for pre-selecting a record when linking. Nothing writes `SCR_USER1` / `SCR_USER2` any more.
- **Desired config** = latest version in the drone's client set with `needs_review = false`. The Default only seeds new drones.
- **Events are append-only**: no UPDATE/DELETE policies. `applied` / `captured` are written only after a verified empty diff.
- **`uid2` is MAVLink 2 only**; `AUTOPILOT_VERSION.uid` is always 0 on ArduPilot.
- **Migrations**: apply them directly with `npx supabase db push` (project rule); current data is test data.
- **Shipping**: user-facing → minor bump via `/ship`. The spike branch `feature/19-log-download-throughput-spike` stays parked and separate.
