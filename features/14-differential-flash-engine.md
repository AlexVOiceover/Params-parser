# 14 — Differential Flash Engine

Make the drone write flow robust with a retry-and-revert loop. The existing `ApplyUpdateButton` does a single diff-write pass with no verification. This stage wraps that logic in a multi-pass engine that re-reads params after each write, retries missing changes, and reverts to the pre-flash snapshot if it gives up — then wires `ApplyUpdateButton` up to it.

## Scope

- **`lib/drone-flash-engine.ts`**: new exported function `flashParamsToDrone(target, port, onProgress)` — steps: diff → write all changes → re-read all params → re-diff → repeat up to 4 passes. Returns `{ ok: boolean, passes: number, unresolved: string[], reverted: boolean }`.
- **Revert on failure**: if still unresolved after 4 passes, write back the pre-flash snapshot (best-effort). If revert also fails, surface which params are in an unknown state.
- **`onProgress` callback**: called with a status string each step so the existing `WriteDroneDialog` log can show pass-by-pass progress.
- **Update `ApplyUpdateButton`**: replace its current inline write logic with a call to `flashParamsToDrone`. The existing `WriteDroneDialog` UI stays unchanged — only the engine under it changes.
- **Result surface**: on success show pass count ("Written in 1 pass"); on partial failure show unresolved param names; on revert show "Reverted to previous state".

## Out of Scope for This Stage

- New UI beyond what `WriteDroneDialog` already shows
- Fleet bring-up wizard (Stage 15)
- Writing `SCR_USER1` / `SCR_USER2` as part of the flash (Stage 15 handles registration)
