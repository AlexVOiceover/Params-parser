# Plan — Drone param lifecycle

End goal: fully traceable param lifecycle — factory state → client customisation → update notifications → field capture → admin review.

## Stage 14 — Differential flash engine

Pure engine, no new UI. The existing `ApplyUpdateButton` already does a single-pass diff-write; this stage makes it robust with retries and revert.

- **`lib/drone-flash-engine.ts`**: `flashParamsToDrone(target, onProgress)` — diff → write → re-read → re-diff loop, max 4 passes. On failure: revert to pre-flash snapshot (best-effort). Returns `{ ok, passes, unresolved, reverted }`.
- **Update `ApplyUpdateButton`** to use the new engine instead of its current single-pass write.
- No new UI beyond what `ApplyUpdateButton` already shows.

---

## Stage 15 — Fleet bring-up

Complete "new drone" workflow when `SCR_USER2=0`: pick variant/client, flash Default, register in DB.

- **Import modal**: when `SCR_USER2=0`, show register panel. Already partially handled by `RegisterDroneModal` — verify what's missing and close gaps.
- **Flash Default**: reuse Stage 14 engine. Write `SCR_USER1` (serial int) and `SCR_USER2=1` as part of the diff target.
- **Client set creation**: if a client is selected, clone Default v1 as the new `client_set` before flashing.

---

## Decisions

| Question | Decision |
|---|---|
| Write loop cap | 4 passes; revert to pre-flash snapshot on failure |
| Orphan drones | Track Default as their param set |
| Register trigger | `SCR_USER2=0` = unversioned → register flow |

---

## Out of scope

- Push notifications / email for updates
- Two-person approval for field captures
- Rollback to older version (data is there; no UI)
- Parameter dependency graph analysis
