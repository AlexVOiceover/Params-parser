# 15 — Fleet Bring-Up

Complete the "first flash" workflow for unversioned drones (`SCR_USER2=0`). The `RegisterDroneModal` already handles DB record creation and builds the param diff — but it calls `WriteDroneDialog` without the multi-pass flash engine, so failed writes don't retry or revert. This stage wires the Stage 14 engine into the registration flow and closes any remaining gaps.

## Scope

- **Wire flash engine**: pass `onStart` to `WriteDroneDialog` inside `RegisterDroneModal` so the registration flash uses `flashParamsToDrone` (retry + revert) instead of the single-pass write
- **`SCR_USER2` in target**: confirm the registration flash includes `SCR_USER2=1` in the diff target (it should already set `SCR_USER1` — verify `SCR_USER2` is also included)
- **Success state**: after a successful flash, show the drone serial, version written, and a link to the variant page
- **Gap audit**: read through `RegisterDroneModal` end-to-end and fix any remaining rough edges (error handling, loading states, edge cases) found during the audit

## Out of Scope for This Stage

- Changes to the DB schema (no new tables or columns needed)
- New UI outside `RegisterDroneModal` and `WriteDroneDialog`
- Capture / review queue (Stage 13, already shipped)
