# 16 — Drone Initialisation Status

Track whether a drone has been physically set up (SCR_USER1 written + Default flashed) vs just existing as a DB record. Surfaces this in the Clients & Drones admin page so admins know which drones still need physical setup.

## Scope

- **DB**: add `initialised_at TIMESTAMPTZ` (nullable) to `drones` table. Null = never physically initialised.
- **Register wizard** (`register-drone-modal.tsx`): on successful flash completion (`handleWriteSuccess`), PATCH `PATCH /api/admin/drones/[id]` to set `initialised_at = now()`. The drone id is already available as `newDroneId` in the modal state.
- **`/api/admin/drones/[id]` PATCH route**: already exists — extend it to accept and write `initialised_at` alongside `serial` and `variantId`.
- **`clients-table.tsx`**: fetch `initialised_at` alongside existing drone fields. Show a small badge per drone row: emerald "Ready" when `initialised_at` is set, amber "Pending setup" when null.
- **Connect modal / home banner**: when drone matches by serial (`status === "matched"`) but `SCR_USER2 === 0`, change the Register button label from "Register this drone & flash defaults" to "Complete setup" — distinguishes a known-but-uninitialised drone from a completely unknown one.

## Out of Scope for This Stage

- Fleet overview page (Stage 17)
- Showing `initialised_at` date in the UI (just the badge is enough)
- Any change to the Register wizard flow itself
- Tracking when a drone was last connected or last updated
