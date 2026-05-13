# Plan — Drone param lifecycle

All previous stages (07–16) have shipped.

---

## Stage 17 — Fleet overview

A single admin page showing all drones across all clients with current status.

- New page `/admin/drones`: serial, client, family/variant, catalog version, link to param set
- Filter by client, variant, update status
- Complements (not replaces) the per-client drone list

---

## Decisions

| Question | Decision |
|---|---|
| Drone registration entry point | Connect via USB → wizard only. No pre-creation without hardware. |
| client_set on registration | Always created (even orphans), always pre-populated with Default v1 |
| client_set delete cascade | If last client_set for a drone is deleted, drone row is also deleted |
| SCR params during registration | SCR_ENABLE=1, SCR_USER1, SCR_USER2 always written, bypassing RUNTIME_PARAMS |
| Flash verification | Per-param write confirmations only — no re-read (avoids user-gesture error) |
| No-echo params | Silence = accepted (reboot-required and CAN params don't echo) |

---

## Out of scope

- Push notifications / email for updates
- Real-time fleet connection status
- Two-person approval for field captures
- Rollback to older version (data is there; no UI)
