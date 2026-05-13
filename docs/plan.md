# 16 Drone Initialisation Status

> Add `initialised_at` to drones so admins can see which physical drones have been set up vs just created in the DB. Surface as badges in Clients & Drones.

## Tasks

1. [ ] **DB migration**
   - [ ] 1.1 Create migration `20260513093113_drones_initialised_at.sql`: `ALTER TABLE drones ADD COLUMN IF NOT EXISTS initialised_at TIMESTAMPTZ;`
   - [ ] 1.2 Push migration with `npx supabase db push`

2. [ ] **Extend PATCH /api/admin/drones/[id]**
   - [ ] 2.1 Accept `initialisedAt: boolean` in body — when true, set `initialised_at = now()`
   - [ ] 2.2 Write `initialised_at: new Date().toISOString()` to the update object when flag is set

3. [ ] **Register wizard sets initialised_at on success**
   - [ ] 3.1 In `handleWriteSuccess` in `register-drone-modal.tsx`, after successful flash, PATCH `/api/admin/drones/${newDroneId}` with `{ initialisedAt: true }` when `newDroneId` is set

4. [ ] **Clients & Drones page — show initialisation status**
   - [ ] 4.1 Add `initialised_at: string | null` to `ClientWithDrones.drones` type in `clients-table.tsx`
   - [ ] 4.2 Update `admin/clients/page.tsx` query to select `initialised_at` on drones
   - [ ] 4.3 Render "Ready" (emerald) or "Pending setup" (amber) badge next to each drone serial in the table

5. [ ] **Connect modal — contextual button label**
   - [ ] 5.1 In `connect-drone-dialog.tsx`, when `match.status === "matched"` and `match.droneVersion === null`, show "Complete setup" instead of "Register this drone & flash defaults"
   - [ ] 5.2 Same change in `drone-status-banner.tsx` for the Register button

6. [ ] **Typecheck**
   - [ ] 6.1 `npx tsc --noEmit` — fix any errors

## Notes

- `newDroneId` is already in state in `register-drone-modal.tsx` — it's set in `handleFlash` before the WriteDroneDialog opens
- The PATCH should fire after `handleWriteSuccess` returns — not inside it, since it's a fire-and-forget (no need to block the UI)
- "Complete setup" vs "Register" only changes the label — the wizard flow is identical
