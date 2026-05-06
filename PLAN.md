# Plan — Drone version tracking, fleet bring-up, and differential flashing

End goal: a fully traceable lifecycle for every drone's param set — from blank factory state through client customisation, over-the-air update notifications, and admin-controlled acceptance of field captures. Split into five sequential stages so each can be shipped independently.

---

## Stage 07 — Integer versions and SCR_USER2 injection

**Scope**: simplify the version model from `N.0` strings to plain integers throughout, and ensure `SCR_USER2` is always written to the uploaded .param file so drones self-report their current version.

- **DB migration**: backfill `param_versions.version_label` from `'N.0'` → `'N'`. Update the unique constraint. Add `CHECK (version_label ~ '^\d+$')` to reject decimals going forward.
- **Upload API** (`/api/upload/route.ts`): after parsing the .param file, overwrite (or insert) `SCR_USER2 = <integer version_label>` in `param_values`. Every file stored in the catalog always carries the version as a param. Same logic as how `SCR_USER1` is read — it just gets written back in.
- **Validation**: change every `/^\d+\.\d+$/` regex to `/^\d+$/` in the upload form, upload modal, and API.
- **Display**: strip all `.0` suffixes from rendered version labels across the catalog, compare page, breadcrumbs, version pills.
- **Auto-suggest**: `${nextMajor}` not `${nextMajor}.0`.
- **Changelog + version**: v0.8.0.

Out of scope: reading SCR_USER2 from a connected drone (that's Stage 08).

---

## Stage 08 — Update notifications (read-only, no write to drone)

**Scope**: when a drone is connected, compare its `SCR_USER2` against the catalog's latest version for that drone's client_set, and surface the result in the import modal and the variant page.

- **Extend `/api/drone/match`** response to also return the matched client_set's latest version integer and whether the drone's SCR_USER2 is less-than, equal, or greater-than that.
- **`useConnectedDroneMatch` hook**: expose `versionStatus: 'up_to_date' | 'update_available' | 'drone_ahead' | 'unknown'` and `droneVersion: number | null`.
- **Import modal**: extend the "Drone identified" recap block:
  - `update_available` → amber callout: *"Update available — catalog v3, your drone is on v2."*
  - `drone_ahead` → blue callout: *"Drone has v5, catalog latest is v3. An admin can capture this."*
  - `up_to_date` → green confirmation next to the version.
  - `unknown` (no SCR_USER2) → no version line.
- **Variant page client_set card**: when the connected drone matches and `update_available`, show a pulsing amber badge "Update available" next to the "this drone" badge.
- No write to drone. No capture button yet. Pure notification.
- **Changelog + version**: v0.9.0.

---

## Stage 09 — "Needs review" and admin capture of field versions

**Scope**: when a connected drone has `SCR_USER2 > catalog_latest`, an admin can capture the drone's current params as a new version flagged `needs_review`. Admins see a global alert and can accept or discard these versions.

- **DB migration**: add `param_versions.needs_review BOOLEAN NOT NULL DEFAULT FALSE`.
- **"Capture from drone" button**: shown in the import modal when `drone_ahead` AND role is `admin` or `contributor`. Clicking:
  1. Reads all connected drone params.
  2. Calls a new `/api/upload` path (or extends existing) with `mode = 'capture'`, which creates a new `param_versions` row with `needs_review = true` and `version_label = droneVersion`.
  3. Shows a confirmation: *"Saved as v5 — marked for review."*
- **Admin alert badge**: on the AppHeader (admin only), fetch count of `param_versions WHERE needs_review = true`. Show a numbered red dot. Link to a new page `/admin/review`.
- **`/admin/review` page**: lists all needs-review versions with: client, drone serial, version, date. Each row has two buttons — "Accept" (sets `needs_review = false`) and "Discard" (deletes the version row). Admin can also open/view the param set before deciding.
- **Variant page**: `needs_review = true` versions show a distinct amber "Pending review" label in the versions list.
- **Changelog + version**: v0.10.0.

---

## Stage 10 — Differential write engine (flash params to drone)

**Scope**: write a target param set to a connected drone using a diff-then-write-then-verify loop. No UI yet — the engine goes in `lib/`, covered by the existing web-serial infrastructure.

- **`lib/drone-flash-engine.ts`**: exported function `flashParamsToDrone(target: Param[], onProgress: (step: string) => void): Promise<FlashResult>`. Steps:
  1. Read all params from drone via existing `openDroneConnection` path.
  2. Diff: `target` vs `current`. Build a `toWrite: Param[]` list.
  3. If diff is empty, resolve `{ ok: true, passes: 0 }` immediately.
  4. Write all params in `toWrite` via MAVLink SET_VALUE, same mechanism as existing write path (investigate `lib/mavlink-serial.ts` — the write command is already there from the connected-drone card's "Apply" flow). See notes below.
  5. Re-read all params from drone.
  6. Re-diff against `target`.
  7. If still differences, increment pass counter and go to step 4. Cap at 4 passes.
  8. If passes exceeded and still different: **revert**. Send a write pass with the original `current` snapshot from step 1. This is a best-effort revert — if the revert itself fails, surface the list of params that are in an unknown state.
  9. Resolve `FlashResult`: `{ ok, passes, unresolved: Param[], reverted: boolean }`.
- **Investigation note on MAVLink writes**: before coding, check `lib/mavlink-serial.ts` and `lib/mavlink-serial-shim.ts` for any existing `PARAM_SET` or `PARAM_VALUE` send path. The connected-drone card already has a "save back to drone" flow — confirm if it uses MAVLink PARAM_SET or if it just triggers a file download. Use whatever is already there rather than reinventing.
- No UI changes in this stage. The function is called by Stage 11.
- **Changelog + version**: v0.11.0.

---

## Stage 11 — Fleet bring-up: flash defaults and create client param sets

**Scope**: the complete "new drone" workflow. Admin connects a drone, picks family/variant (and optionally a client), and the app flashes the Default params + creates the client_set starting at v1.

- **"Flash to drone" button** on the variant page (admin only), and in the import-from-drone modal (admin only) when a match is found and the drone needs a version.
  - Clicking opens a confirmation sheet: shows the target version, the params to be written (count), and a "Start flash" button.
  - Progress bar / log during flashing (reuse the connect-drone dialog's log component).
  - On success: *"v3 written. 0 params unresolved."* Optionally show a "Reload catalog" link.
  - On revert: amber warning — *"Flash failed after 4 passes. Reverting to previous state. N params couldn't be set."*
- **Client set creation on bring-up** (new-drone flow in the import modal):
  - If the drone has no client_set on this variant yet AND admin picks a client, offer *"Create client set (v1) by cloning from Default"*. Clicking:
    1. Calls the existing clone API to fork the Default → new client_set with `version_label = 1`.
    2. Then starts the flash flow above targeting the new client_set v1.
    3. Drone ends up with: the right params + `SCR_USER1 = serial trailing-int` (already there) + `SCR_USER2 = 1`.
- **`SCR_USER1` write**: at bring-up time, if the drone's `SCR_USER1` doesn't match the expected trailing serial int, write it as part of the flash (include it in the diff target). This ensures every drone self-identifies from the first flash onward.
- **Changelog + version**: v0.12.0.

---

## Decisions captured

| Question | Decision |
|---|---|
| Version format | Integers only. `'1.0'` → `'1'`, `'2'` → `'2'`. |
| SCR_USER2 injection | Written at upload time, always. Version label is the source of truth. |
| Version encoding | Integer = integer. Major number only, minor dropped. |
| Auto-capture when drone ahead | No silent capture. Admin presses a button. Rationale: silent capture risks piling up junk versions. |
| Capture permission | Admin or contributor only. Client users cannot push to catalog. |
| Needs-review acceptance | Admin sets `needs_review = false`. No additional approval flow. |
| New client_set initial version | v1, cloned from Default at bring-up time. |
| Write loop cap | 4 passes. On failure: revert to pre-flash snapshot. |
| Revert on failed flash | Yes — best-effort write of original snapshot. Surface unresolved params if revert also fails. |
| SCR_USER1 at bring-up | Written to drone if not already correct. Included in the diff target. |
| "Drone ahead" on client connect | Client sees the version status in the modal (update available / up to date / unknown). They cannot capture. Admin is notified via the review queue. |

---

## Out of scope (future)

- Push notifications / email to clients when an update is available.
- Two-person approval for accepting field captures.
- Rollback a drone to an older version (UI — the data is already in the catalog).
- Offline / disconnected flashing (file download only, no MAVLink).
- Parameter dependency graph analysis (the loop-with-cap approach handles it without needing one).
