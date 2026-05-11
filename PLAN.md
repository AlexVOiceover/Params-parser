# Plan — Drone param lifecycle

End goal: fully traceable param lifecycle — factory state → client customisation → update notifications → field capture → admin review.

## Stage 15 — Fleet bring-up

Complete "new drone" workflow when `SCR_USER2=0`: pick variant/client, flash Default, register in DB.

- **Import modal**: when `SCR_USER2=0`, show register panel. Already partially handled by `RegisterDroneModal` — verify what's missing and close gaps.
- **Flash Default**: reuse Stage 14 engine. Write `SCR_USER1` (serial int) and `SCR_USER2=1` as part of the diff target.
- **Client set creation**: if a client is selected, clone Default v1 as the new `client_set` before flashing.

---

## Decisions

| Question | Decision |
|---|---|
| Orphan drones | Track Default as their param set |
| Register trigger | `SCR_USER2=0` = unversioned → register flow |

---

## Out of scope

- Push notifications / email for updates
- Two-person approval for field captures
- Rollback to older version (data is there; no UI)
- Parameter dependency graph analysis
