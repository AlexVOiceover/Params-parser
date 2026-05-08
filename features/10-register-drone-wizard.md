# 10 — Register Drone Wizard

A unified modal wizard triggered when a connected drone has `SCR_USER2=0` (unversioned). Handles all cases — blank drone, drone with an unregistered serial, drone with a known serial — through a single flow. On completion the drone row exists in the DB, optionally a `client_set` is created, and the drone is flashed with the Default param set (setting `SCR_USER1` and `SCR_USER2=1`).

## Scope

- **Trigger detection**: in `components/connect-drone-dialog.tsx` and `components/drone-status-banner.tsx`, detect `SCR_USER2=0` after a successful import and show a "Register this drone" prompt/button.

- **Case detection (step 1)**:
  - `SCR_USER1=0` → fully blank; needs all fields.
  - `SCR_USER1=N`, not in `drones` table → serial unknown; pre-fill serial, ask family/variant.
  - `SCR_USER1=N`, found in `drones` table → drone known; pre-fill everything from DB, show locked fields, skip straight to confirmation.

- **`RegisterDroneModal` component** (`components/register-drone-modal.tsx`): a multi-step modal (same style as `ConnectDroneDialog`) with three internal stages — form, confirm, flashing.

- **Form step (step 2)**:
  - **Serial** — required if `SCR_USER1=0`; pre-filled and locked (read-only) if `SCR_USER1>0`.
  - **Family** — required dropdown from existing families; locked if drone already in DB.
  - **Variant** — required dropdown filtered by family; locked if drone already in DB.
  - **Client** — optional dropdown from existing clients, with a "No client (orphan)" option at the top selected by default.

- **Confirmation step (step 3)**: summary card showing serial, family/variant, client (or "Orphan — will track Default"), and the Default version that will be flashed. "Register & Flash" CTA.

- **Flash step (step 4)**:
  - Create `drone` row in DB if it doesn't exist — call `POST /api/admin/clients/[clientId]/drones` if a client is selected, or a new `POST /api/admin/drones` endpoint if no client.
  - Create `client_set` row only if a client was selected — call `POST /api/admin/client-sets` with the drone linked.
  - Write to drone via MAVLink: `SCR_USER1 = serial trailing-int` (if not already correct), then flash the Default param set using the existing `WriteDroneDialog` / `writeDroneParams` infrastructure. `SCR_USER2=1` is already in the Default file.
  - Success: show confirmation. Error: best-effort revert message.

- **New API endpoint**: `POST /api/admin/drones` — creates a drone row without requiring a client (for orphan registration). Accepts `{ serial, variantId }`. Returns the new drone id. Admin/contributor only.

- **DB**: no new tables. Uses existing `drones`, `client_sets`, `param_versions`.

- **Integration points**:
  - `ConnectDroneDialog` — after import completes, if `SCR_USER2=0`, show "Register this drone" button that opens the modal.
  - `DroneStatusBanner` — if `SCR_USER2=0` and drone is unmatched/unregistered, show "Register" call-to-action instead of/alongside the existing states.

## Out of Scope for This Stage

- NFC tag writing (Stage 11) — offered as a follow-up step after successful registration but built separately.
- The differential write engine refactor (Stage 13) — the existing `WriteDroneDialog` + `writeDroneParams` is sufficient.
- Any changes to the `/admin/clients` UI beyond adding the new API endpoint.
- Editing family/variant of an already-registered drone from within this wizard — that belongs in `/admin/clients`.

## Notes

- The `POST /api/admin/drones` endpoint for orphans is new. The existing `POST /api/admin/clients/[clientId]/drones` requires a client; orphan registration doesn't have one. Simplest implementation: accept `clientId` as optional and create the drone under the `drones` table with `client_id=null` if omitted.
- The flash uses the existing `WriteDroneDialog`. The target param set is the Default's latest `param_version`. Wire it via `ApplyUpdateButton` logic or directly call `writeDroneParams`.
- "Locked" fields for known drones should visually grey out and show a tooltip "Cannot change — drone is already registered. Edit in Clients & Drones."
- If the drone is already in DB (case 3) but no Default exists for the variant, show an error: "No Default param set found for this variant. Upload one first."
