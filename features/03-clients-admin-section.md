# 03 — Clients admin section

Introduce a `Clients` (companies) entity and a child `drones` (serial numbers) entity, plus an admin UI to manage them at `/admin/clients`. Includes the Stage-1 header rename (Settings → Users) so the user dropdown is ready for the new Clients link beside it. Existing free-text `client_sets.client_name + serial` data is backfilled into the new tables, but the upload flow itself keeps using the free-text fields for now — Stage 04 will switch upload to dropdowns sourced from these tables.

## Scope

- **DB**: new `clients` (`id`, `name UNIQUE`, `created_by`, `created_at`, `updated_at`) and `drones` (`id`, `client_id` FK CASCADE, `serial`, `created_by`, `created_at`, `UNIQUE(client_id, serial)`) tables. RLS public read, admin/contributor write (technician role comes in stage 04).
- **Backfill**: insert one `clients` row per distinct `client_sets.client_name`, one `drones` row per distinct `(client_name, serial)` where serial is non-empty (Defaults skipped — they have empty serial and don't represent a real drone). Add `client_sets.client_id` (nullable) and `client_sets.drone_id` (nullable) FK columns and link them up. Old text columns stay this stage; Stage 04 drops them.
- **Header**: rename the `Settings → Admin` menu item in `components/app-header.tsx` to `Users` (still links to `/admin`). Add a sibling **Clients** item that links to `/admin/clients`. Both visible to admins only, same as today.
- **Routes**:
  - `app/(app)/admin/clients/page.tsx` — list + inline create (name only).
  - `app/(app)/admin/clients/[clientId]/page.tsx` — client name (editable), list of drones (serial), inline create + delete.
- **API**:
  - `GET /api/admin/clients` (list), `POST` (create — body `name`).
  - `PATCH /api/admin/clients/[id]` (rename), `DELETE` (cascades drones — block if any `client_sets.client_id` references this client).
  - `POST /api/admin/clients/[id]/drones` (body `serial`).
  - `DELETE /api/admin/drones/[id]` (or nest under client; pick whichever pattern is cleanest).
- **Types**: add `Client` and `Drone` interfaces in `lib/types.ts`. Update `ClientSet` to optionally carry `client_id` and `drone_id` (both nullable while the migration is in flight).
- **Verify**: `npm run build` and `tsc --noEmit` clean. After applying the migration, every distinct `client_name` in `client_sets` appears as a `clients` row, and every non-Default `client_set` has its `client_id` and `drone_id` populated. Smoke-test on Vercel preview: navigate to `/admin/clients`, create / rename / delete clients, add and remove drones.

## Out of Scope for This Stage

- **Switching the upload flow to dropdowns** — that's Stage 04. The upload form and Publish-to-Catalog modal still use free-text Client + Serial fields this stage. The new `clients` / `drones` tables exist but aren't *consumed* by uploads yet.
- **Dropping `client_sets.client_name` and `client_sets.serial`** — kept for one more stage as a safety net so we can verify the FKs match the text values.
- **Roles (technician, client) and per-client visibility** — Stage 05. RLS this stage uses today's `is_admin()` / `is_contributor_or_admin()` helpers unchanged.
- **Adding `is_default` boolean to `client_sets`** — Stage 05 needs it for the RLS rewrite, but this stage continues to identify Default by `serial = ""`.
- **Inviting client users via the admin dashboard** — Stage 05.
- **Any UI changes to the catalog/variant pages** — they keep showing the same data, just with a now-redundant text representation.
