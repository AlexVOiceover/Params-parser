# 20 — Chip-ID Identity and Desired-State Config

Replace the `SCR_USER1` / `SCR_USER2` drone identity and versioning with two things that cannot drift: the flight controller's **hardware chip ID**, linked by staff to a drone record, and a **direct comparison** between what a drone should have and what it actually has.

## Why

Today a drone says who it is (`SCR_USER1`) and which catalog version it carries (`SCR_USER2`) through two params. Both are claims, and anything can make them false:

- Saving a new version *from the drone* stamps `SCR_USER2 = 3` into the catalog copy only. The drone keeps saying v1, the banner shows "Update available v1 → v3", and Apply update cannot fix it — `SCR_USER2` is a volatile param, so the computed diff is empty and the app answers "already up to date". The state is stuck.
- Editing params in Mission Planner leaves `SCR_USER2` untouched, so a modified drone still claims its old version.
- Uploading a Mission Planner file as a new version gives the catalog a new number the drone never hears about.
- A param reset wipes both, and the drone loses its identity.

Patching how the number is kept in step would always leave a gap. The fix is to stop storing state on the drone and stop trusting it.

The design follows established device-management practice: desired vs reported state (as in AWS IoT Device Shadow and Azure Device Twin), a hardware identity claimed to a record in a separate step, writes verified by reading back, and an append-only audit log.

## The model

- **Default ("catalog reference")**, one per variant: a *template*. It evolves, and it is what a new drone starts from. It does not govern drones that already exist.
- **Drone record**: the business identity — the serial on the airframe label (`AIR4-0626-0024`), the client, and the drone's history. It can be created and edited at any time **without the hardware**, exactly as today.
- **Drone history** (the drone's client set): that airframe's own config timeline. Its **latest approved version is the drone's desired config**.
- **Chip link**: binds a drone record to one physical flight controller by its chip ID. It is made **later**, by staff, and can be changed by an admin.
- **Pushing a change**: staff add a version to a drone's history. When the client next connects, the app shows that an update is available, and they apply it.

Only two things need the chip link: judging the status of a connected drone, and writing to it. Both already need the drone plugged in, so nothing created in advance is ever blocked.

### Six rules

1. **The catalog is the only source of truth.** Each drone has exactly one desired config: the latest version in its history with `needs_review = false`.
2. **Drone state is only ever read, never assumed.** Nothing on the drone records a version. `SCR_USER2` is dropped.
3. **Identity is the FC's chip ID, linked to a record by staff.** ArduPilot sends the MCU's factory-burned 12-byte unique ID in `AUTOPILOT_VERSION.uid2` (`AP_HAL_ChibiOS/Util.cpp` → `get_system_id_unformatted`). No param edit, param reset or reflash changes it.
4. **Status is one comparison**, desired vs actual, done by one shared function. **Every param is managed unless it is on the unmanaged list.**
5. **A write only counts once it has been read back.** Success means the comparison is empty afterwards.
6. **Firmware is recorded and checked.** Every version and every log entry carries the ArduPilot firmware version. A mismatch is shown, never silently compared.

Changes flow one way: **catalog → drone**. A good change made in the field enters the catalog as a new version first.

### The three states of a connected, linked drone

| State | How it is known | What the user sees |
|---|---|---|
| ✅ **In sync with vN** | Diff against vN is empty | Nothing to do |
| 🔔 **Update available: vN** | Not in sync, but the drone still equals the version in its last apply-log entry, and vN is newer | "AIR6 has an update for this drone: 3 params change", with the list → **Apply** |
| ⚠️ **Modified on the drone** | Equals neither vN nor its last logged version | "5 params differ from vN", with the list → **Restore vN** or **Save as new version** |

A drone with no apply-log entry yet (every drone straight after migration) cannot tell the last two apart. It shows a neutral **"Differs from vN: X params"**, with both actions.

A drone that is not linked yet shows no status and allows no writes:
- **Staff** see the link step (see Identity).
- **Clients** see "This drone isn't set up for updates yet — contact AIR6."

## Scope

### Identity — chip read

- The connect read requests `AUTOPILOT_VERSION` (`MAV_CMD_REQUEST_MESSAGE` 148) and parses `uid2`. This was done and verified on hardware during the chip-ID test, in `lib/mavlink-serial.ts`.
- `uid2` is a MAVLink 2 extension field. On a v1 link the read reports the ID as missing and says why.
- The same message carries `flight_sw_version` (major.minor.patch.type). Parse it in the same place (see Firmware).

### Identity — linking (staff only: admin and contributor)

- **DB**: `drones.chip_id text UNIQUE NULL`. `NULL` means "not linked yet". Records, histories and versions work without it.
- **Lookup**: `/api/drone/match` takes `chip_id` and resolves the drone, its client, family, variant and history. The connect modal shows the chip ID together with everything it shows today (serial, client, family, variant).
- **Three ways to link** (any one is enough):
  - **A — at connect, in the app.** An unknown chip opens *"This flight controller isn't linked yet. Which drone is it?"*
    - The list holds the unlinked drone records.
    - If `SCR_USER1` matches exactly one of them, that record is pre-selected. This covers the existing fleet.
    - The rest are ordered by how close their latest version is to the params just read. This ordering is a hint only.
    - Staff confirm the choice against the serial label on the airframe.
    - Once linked, the status check runs straight away in the same session.
  - **B — remotely, without our app.** The drone record gets a "Link flight controller" field. It accepts either the chip ID or the whole line from Mission Planner's **Messages** tab, which ArduPilot sends on every ground-station connect (`GCS_Common.cpp` → `send_banner`). Example: `CubeOrangePlus 00320021 3438510B 36373832`. The line prints the same 12 bytes with each 4-byte group in reverse order; the app converts it. This is how staff link a drone that is far away.
  - **C — at assembly.** When an FC goes into a new airframe, connect it once and link it. This becomes a step in the bring-up checklist.
- **Safety**:
  - One chip ID can belong to only one drone record.
  - A linked record seeing a different chip = an FC swap. Admin-only **"Re-link (flight controller replaced)"**.
  - Staff can also **unlink** a wrong link.
  - `SCR_USER1` is a hint for pre-selection only. It is never used as identity, and nothing writes it any more.
- **Write guard**: every write session requests `AUTOPILOT_VERSION` before the first `PARAM_SET` and refuses to write if the chip ID differs from the snapshot's, or if the drone is not linked. This replaces the 9-param fingerprint (`IDENTITY_PARAMS` in `lib/drone-params-shared.ts`).

### Firmware

- Parse `flight_sw_version` from `AUTOPILOT_VERSION` into `major.minor.patch`.
- **DB**: `param_versions.firmware text NULL`.
  - A version captured from a drone records the drone's firmware.
  - A version uploaded from a file gets an optional firmware field, because `.param` files don't carry it. If left empty, it shows as "unknown".
  - A clone inherits its source's firmware.
- Every `drone_events` row records the drone's firmware at that moment.
- **Check**: if the desired version's firmware major.minor differs from the drone's, the status shows **"v4 was made for 4.5, this drone runs 4.6"** above the diff. Apply then needs an explicit confirmation. Differences that come from the firmware change, such as params that are missing or renamed, are then understandable rather than alarming.

### Unmanaged params — one generic list, managed by default

- `data/unmanaged-params.json`, using the same `prefix` / `exact` rule format as `data/protection-lists.json`. One list for every drone.
- **Managed by default**: a param is excluded only if it is on this list. A missing entry causes a visible false difference, which is safe. Never add an entry just to silence a difference without understanding it.
- Seeded from the Calibration and Hardware & Device IDs protection lists plus `data/volatile-params.json`.
- Used in exactly two places: the comparison, and the Default → new-drone apply (the new drone keeps its own calibration).

### The comparison

- One shared function, `diffDesired(desired, actual)`, in `lib/` and used by both client and server. It returns `{ name, desired, actual }[]`.
- A param in the version but missing on the drone **counts as a difference**. A param on the drone but not in the version is ignored, since Mission Planner files can be partial.
- **Equality**: the values round to the same float32 (`Math.fround`), or they differ by no more than float32 precision (relative 1e-6). That covers Mission Planner's 7-significant-digit text output against the drone's exact float32.
- Every status in the app comes from this function. The separate drift check goes away.

### Apply log

- **DB**: `drone_events (id, drone_id, param_version_id NULL, chip_id, firmware, kind, diff_count, method NULL, created_by, created_at)`.
- `kind` is one of `applied`, `captured`, `linked`, `relinked`, `unlinked`.
- `method` records how a link was made: `connect`, `messages_line` or `assembly`.
- `applied` and `captured` are only written after a **verified** read-back. `param_version_id` is the version the drone was verified to equal.
- **RLS**:
  - Users who can see the drone can read its events.
  - Inserts follow the role rules: link events by staff only; `applied` / `captured` by anyone who can see the drone.
  - Nobody can update or delete events.
- **Drone history page**: shows the log next to the versions: "v3 applied 2 Jun by Hansab · verified · 4.5.7". That is how you see whether a push actually landed.

### Apply and verify

1. **Write** only the differing managed params.
2. **Read back** every written param by name (`PARAM_REQUEST_READ`, index −1; the builder was fixed earlier in this work).
3. Run `diffDesired` again on the written set.
   - Empty → log `applied` → status becomes *In sync*.
   - Not empty → show exactly which params did not take, and log nothing.
4. "No echo — assumed written" goes away. Every write is confirmed by an explicit read.

### Status UI

- **Connect modal**: after the read, it shows the chip ID, the identity details, the firmware, the state, and the diff list. For *Update available* this **is** the update popup the client sees on connect, with **Apply** directly in it.
- **Catalog banner and variant page highlights**: driven by the same state.
- **Save as new version** (everyone): available on *Modified* and *Differs*. It creates the next version in the drone's history from the read, records the firmware, and logs `captured`.
  - Saved by an admin → approved immediately → the drone becomes *In sync*.
  - Saved by anyone else → `needs_review = true` → the drone shows *Modified — saved as vN, pending review* until an admin accepts it.
- **Admin drones list**: shows **"Not linked"** for records without a chip ID, so it is clear which airframes still need linking.

### New drone bring-up

- Create the record → link the FC (method C) → apply the variant's Default **minus unmanaged params** → verify → save the result as **v1 of the drone's history** → log `captured`.

### Removed

- `SCR_USER2` injection in `app/api/upload/route.ts`, `app/api/admin/param-versions/[id]/clone/route.ts`, and `app/api/admin/param-versions/[id]/values/route.ts`.
- `app/api/drone/drift`, the `up_to_date_modified` and `drone_ahead` states, and the drone-ahead capture button in `connect-drone-dialog.tsx`. "Save as new version" replaces it.
- The `SCR_USER2`-keyed match cache in `lib/use-connected-drone-match.ts`.
- `SCR_USER1` as identity. It remains only as a pre-selection hint in linking method A.
- The register wizard's writes of `SCR_ENABLE`, `SCR_USER1` and `SCR_USER2`.
- `IDENTITY_PARAMS` and the fingerprint check (replaced by the chip-ID write guard).
- The version-marker row for `SCR_USER2` in `write-drone-dialog.tsx`.

## Migration

- Add `drones.chip_id`, `param_versions.firmware` and `drone_events`. Existing versions stay untouched with firmware "unknown". Any `SCR_USER2` rows in `param_values` become ordinary unmanaged values.
- Existing drones get linked by staff:
  - in the workshop on their next visit, or on a staff-run connect (A, pre-selected through `SCR_USER1`);
  - remotely from a Mission Planner Messages line (B).
- Until a drone is linked, a client connecting it sees "contact AIR6" instead of an update. **Link the drones you intend to push updates to before telling their operators.**

## Out of Scope for This Stage

- Proposing Default changes to many drones at once ("push Default v5's changes into selected drone histories"). This is a natural follow-up, because the model already supports it.
- Offline or remote status: drones are only judged when connected.
- MAVLink v1 links: a drone that only speaks v1 has no chip ID and is refused with a clear message.
- Cryptographic device identity. The chip ID is reported by firmware and could be faked by modified firmware. That is acceptable: the threat model is mistakes, not attackers.
- Log download (feature 19).

## Open Questions

- **Is RC configuration managed?** By default it is, unless it is added to the unmanaged list.
- **Reboot-required params**: ArduPilot stores the value immediately, so reading it back should return the new value. Confirm on hardware during verification.
- **NFC tag linking**: feature 11 already writes NFC tags. Scanning a tag on the airframe could replace the serial-label check in linking method A. Worth a follow-up once the base flow works.
- **Stage numbering**: PLAN.md uses Stage 19 for mission upload/download and Stage 20 for flight control. This file takes the next free `features/` number.

## Notes

- The chip-ID read was verified on hardware before this file was written: the connect modal shows it.
- `AUTOPILOT_VERSION.uid` (the plain u64) is always 0 on ArduPilot. Only `uid2` carries the ID.
- Status checks should never block on the network for long: if the lookup fails, show "Couldn't check against the catalog" rather than a stale state.
- Because status is always worked out fresh from a live read, failures fix themselves: an interrupted write or a Mission Planner edit simply shows up truthfully on the next connect.
