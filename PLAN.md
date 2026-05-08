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

## Stage 09 — Orphan drone Default tracking

**Scope**: drones with no `client_set` ("orphan drones") should track the Default param set for their variant and receive "Update available" notifications when the Default advances. Currently the match endpoint returns `versionStatus=unknown` for orphans because `catalog_version` comes from the drone's `client_set`, which doesn't exist.

- **Extend `/api/drone/match`**: if `clientSet` is null (no `client_set` for this drone + variant combo), fall back to looking up the Default `client_set` for the variant (`is_default=true`). Use that Default's latest version as `catalog_version`. Mark the response with a new field `is_orphan: true` so the UI can differentiate.
- **`useConnectedDroneMatch` hook**: surface `isOrphan: boolean` so components can branch on it.
- **Import modal recap**: orphan drones show "No client assigned" in place of the Client row. Version status line still works (up to date / update available against the Default).
- **Catalog home banner**: orphan drones with an update available show the amber "Update available: v1 → v2" strip and Apply update button (flashes the Default).
- **Variant page**: no client_set card is highlighted (no match) — just the Default card gets the "your drone" emerald styling. The "Apply update" button appears on the Default card when the drone is behind.
- **Changelog + version**: v0.10.0.

---

## Stage 10 — Register drone wizard

**Scope**: unified "Register this drone" flow triggered when `SCR_USER2=0` (unversioned drone). Handles all cases: blank drone, drone with serial not in DB, drone with serial already in DB.

### Trigger
- Show a "Register this drone" panel in the import modal and the catalog home banner when `SCR_USER2=0`.
- Do not show for `SCR_USER2 > 0` (already registered) — those go through normal update flow.

### Case detection (step 1)
- **`SCR_USER1=0`**: fully blank drone → go to full registration form.
- **`SCR_USER1=N`, not in `drones` table**: serial not registered → pre-fill serial, ask family/variant/client.
- **`SCR_USER1=N`, found in `drones` table**: drone known but unversioned → pre-fill everything from DB record, only ask for confirmation + optional client assignment.

### Registration form (step 2)
Fields shown depend on case:
- **Serial** (required if `SCR_USER1=0`; pre-filled and locked if `SCR_USER1>0`)
- **Family** (required; dropdown of existing families)
- **Variant** (required; filtered by family)
- **Client** (optional; dropdown of existing clients)
  - If left blank: drone is registered as an orphan (no `client_set`). The Default is its param set.
  - If selected: a `client_set` is created for this drone + client linking them.

### Confirmation screen (step 3)
Before any writes, show a summary card:
- Serial that will be written to drone (as `SCR_USER1`)
- Family / Variant
- Client (or "No client — will track Default")
- Default version that will be flashed (`v1`)
- "Register & Flash" CTA

### On confirm (step 4)
1. **Create `drone` row** in DB if it doesn't exist (`serial`, `client_id` if any, `variant_id`).
2. **Create `client_set` row** only if a client was selected (clone Default v1 as the initial version).
3. **Write to drone via MAVLink** (reuse existing write dialog):
   - `SCR_USER1 = serial trailing-int` (if not already correct)
   - Flash Default param set for the variant (differential write)
   - `SCR_USER2 = 1` is already in the Default file (injected at upload time)
4. **On success**: show confirmation. Drone is now registered, version = 1.
5. **On failure**: best-effort revert (same pattern as Apply update). Surface unresolved params.

### DB / API
- Reuse existing `POST /api/admin/clients/[id]/drones` to create the drone row.
- Reuse existing `POST /api/admin/client-sets` to create the client_set (with `isDefault=false`, linked to new drone).
- The flash itself uses the existing `ApplyUpdateButton` / write dialog infrastructure.

### UI notes
- The wizard is a modal (same style as the import dialog).
- Client field shows a "No client (orphan)" option at the top — selected by default.
- If the drone was already in the DB (case 3), the family/variant fields are shown but locked (greyed out, not editable) to avoid accidentally re-assigning a drone to a different variant.
- **Changelog + version**: v0.11.0.

---

## Stage 11 — NFC tag writing (Android)

**Scope**: let admins write a drone's serial number to an NFC sticker directly from the app on an Android phone, replacing the third-party NFC app currently used. Uses the Web NFC API (`NDEFReader`), which is available in Android Chrome only.

### What gets written
Each tag carries two NDEF records:
1. **URL record** — `https://air6params.vercel.app/drone/<serial>` — tapping the sticker on a phone with the app opens directly to that drone's info.
2. **Text record** — plain serial string (e.g. `AIR4-0426-0023`) — readable by any NFC reader app as a fallback.

### Deep-link route
- New page `app/(app)/drone/[serial]/page.tsx`. Looks up the serial in `drones`, redirects to the variant page if found, shows a "drone not registered" message if not. This makes the URL on the tag useful immediately.

### `useNFC` hook (`lib/use-nfc.ts`)
Wraps `NDEFReader`:
- `isSupported: boolean` — false on iOS, desktop, non-Chrome Android.
- `write(records: NDEFRecord[]): Promise<void>` — requests permission, prompts user to tap tag, resolves on success.
- Error states: `permission_denied`, `write_failed`, `not_supported`.

### `WriteNFCButton` component (`components/write-nfc-button.tsx`)
- Shown only when `isSupported` is true (silently hidden on unsupported platforms).
- Props: `serial: string` — the drone serial to encode.
- States: idle → waiting (tap phone to tag, animated) → success → error.
- Reusable anywhere a drone serial is visible.

### Integration points
1. **`/admin/clients` drone row** — "Write NFC" icon button next to each drone's serial (admin only).
2. **Register drone wizard** (Stage 10) — final step offers "Write NFC tag" button after successful registration.
3. **Drone info deep-link page** `/drone/[serial]` — shows basic drone info (family, variant, client if any) when someone taps the sticker.

### Platform handling
- iOS: `WriteNFCButton` renders nothing. No error, no placeholder.
- Desktop: same — hidden silently.
- Android non-Chrome: show a small "NFC not available in this browser" tooltip on the hidden button if the user somehow triggers it.

### DB / API
No new DB schema. The drone serial is already in `drones.serial`. The deep-link page reuses existing session-scoped queries.

### Changelog + version: v0.11.0.

---

## Stage 12 — "Needs review" and admin capture of field versions

**Scope**: when a connected drone has `SCR_USER2 > catalog_latest`, an admin can capture the drone's current params as a new version flagged `needs_review`. Admins see a global alert and can accept or discard these versions.

- **DB migration**: add `param_versions.needs_review BOOLEAN NOT NULL DEFAULT FALSE`.
- **"Capture from drone" button**: shown in the import modal when `drone_ahead` AND role is `admin` or `contributor`. Clicking:
  1. Reads all connected drone params.
  2. Calls a new `/api/upload` path (or extends existing) with `mode = 'capture'`, which creates a new `param_versions` row with `needs_review = true` and `version_label = droneVersion`.
  3. Shows a confirmation: *"Saved as v5 — marked for review."*
- **Admin alert badge**: on the AppHeader (admin only), fetch count of `param_versions WHERE needs_review = true`. Show a numbered red dot. Link to a new page `/admin/review`.
- **`/admin/review` page**: lists all needs-review versions with: client, drone serial, version, date. Each row has two buttons — "Accept" (sets `needs_review = false`) and "Discard" (deletes the version row). Admin can also open/view the param set before deciding.
- **Variant page**: `needs_review = true` versions show a distinct amber "Pending review" label in the versions list.
- **Changelog + version**: v0.12.0.

---

## Stage 13 — Differential write engine (flash params to drone)

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
- No UI changes in this stage. The function is called by Stage 14.
- **Changelog + version**: v0.13.0.

---

## Stage 14 — Fleet bring-up: flash defaults and create client param sets

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
- **Changelog + version**: v0.14.0.

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
| Orphan drones (no client_set) | Track Default as their param set. Version comparisons use Default's latest version. No client_set created unless a client is explicitly assigned. |
| `client_sets` table rename | Keep DB name as-is. Rename display strings to "param set" / "drone set" in UI only. Full DB rename deferred to a cleanup sprint. |
| Register wizard trigger | `SCR_USER2=0` = unversioned drone → show register flow. `SCR_USER2>0` = already registered → normal update flow. |
| Client optional at registration | If no client selected, drone is registered as orphan. No `client_set` created. Drone tracks Default. |
| Family/variant locked if drone known | If `SCR_USER1` matches an existing `drones` row, family/variant are shown but not editable — cannot accidentally re-assign. |
| NFC platform support | Android Chrome only (Web NFC API). iOS not supported — `WriteNFCButton` renders nothing on unsupported platforms, no error shown. |
| NFC tag content | URL record (`/drone/<serial>`) + Text record (plain serial). URL opens the deep-link page; text is universal fallback. |

---

## Out of scope (future)

- Push notifications / email to clients when an update is available.
- Two-person approval for accepting field captures.
- Rollback a drone to an older version (UI — the data is already in the catalog).
- Offline / disconnected flashing (file download only, no MAVLink).
- Parameter dependency graph analysis (the loop-with-cap approach handles it without needing one).
