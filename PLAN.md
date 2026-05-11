# Plan — Drone param lifecycle

End goal: fully traceable param lifecycle — factory state → client customisation → update notifications → field capture → admin review.

---

## Stage 13 — Admin capture of field versions

When `versionStatus === "drone_ahead"`, an admin can capture the drone's params as a new catalog version flagged `needs_review`.

- **DB**: add `param_versions.needs_review BOOLEAN NOT NULL DEFAULT FALSE`
- **"Capture" button** in import modal (admin only, `drone_ahead`): reads connected drone params, posts to `/api/upload` with `mode='capture'`, creates a version row with `needs_review=true` and `version_label=droneVersion`. Shows "Saved as vN — marked for review."
- **Admin alert badge** on AppHeader: count of `needs_review=true` versions, red dot, links to `/admin/review`
- **`/admin/review` page**: lists pending versions (client, serial, version, date) with Accept (`needs_review=false`) and Discard (delete row) buttons. Allow viewing params before deciding.
- **Variant page**: `needs_review=true` versions show an amber "Pending review" label in the versions list

---

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
| Version format | Integers only (`'1'`, `'2'`, …) |
| SCR_USER2 injection | Written at upload time; version label is the source of truth |
| Capture permission | Admin/contributor only |
| Needs-review acceptance | Admin sets `needs_review=false`; no second approval |
| Write loop cap | 4 passes; revert to pre-flash snapshot on failure |
| Orphan drones | Track Default as their param set |
| Register trigger | `SCR_USER2=0` = unversioned → register flow |
| NFC platform | Android Chrome only; hidden silently elsewhere |

---

## Out of scope

- Push notifications / email for updates
- Two-person approval for field captures
- Rollback to older version (data is there; no UI)
- Parameter dependency graph analysis
