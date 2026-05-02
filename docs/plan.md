# 03 Clients admin section

> Introduce `clients` (companies) and `drones` (serials) tables, an admin UI at `/admin/clients`, and rename the user-dropdown "Admin" link to "Users" to make room for the new "Clients" link beside it. Backfill existing free-text `client_sets.client_name + serial` data into the new tables. Upload flow keeps using free-text fields this stage — Stage 04 switches it to dropdowns.

## Tasks

1. [ ] **Database migration**
   - [ ] 1.1 Write `supabase/migrations/<ts>_add_clients_and_drones.sql`: create `clients` (`id`, `name UNIQUE`, `created_by`, `created_at`, `updated_at`), create `drones` (`id`, `client_id` FK CASCADE, `serial`, `created_by`, `created_at`, `UNIQUE(client_id, serial)`, `idx_drones_client`). Enable RLS on both. Add `client_sets.client_id` (nullable FK to `clients.id` ON DELETE RESTRICT) and `client_sets.drone_id` (nullable FK to `drones.id` ON DELETE RESTRICT).
   - [ ] 1.2 In the same migration, backfill: insert one `clients` row per distinct `client_sets.client_name`. Then insert one `drones` row per distinct `(client_name, serial)` where serial is non-empty. Then update each non-Default `client_set` row (i.e. `serial != ''`) to set `client_id` and `drone_id` from the lookups. Defaults (empty serial) keep `client_id = NULL` and `drone_id = NULL`.
   - [ ] 1.3 RLS policies: `clients_select_all` (public read), `clients_write_admin_or_contributor` (insert/update/delete via the existing `is_contributor_or_admin()` helper for insert/update, `is_admin()` for delete — match the existing variants policy shape). Same shape for `drones_*` policies.
   - [ ] 1.4 Apply via `npx supabase db push`. Verify with REST: `clients` count matches distinct `client_name` count, `drones` count matches distinct `(client_name, serial)` non-empty pairs, every non-Default `client_set` has both FK columns populated.

2. [ ] **Lib types**
   - [ ] 2.1 In `lib/types.ts`: add `Client` (`id`, `name`, `created_by`, `created_at`, `updated_at`) and `Drone` (`id`, `client_id`, `serial`, `created_by`, `created_at`) interfaces. Update `ClientSet` with optional `client_id: string | null` and `drone_id: string | null` fields.

3. [ ] **API routes — clients**
   - [ ] 3.1 Create `app/api/admin/clients/route.ts` with `GET` (list — body `{ clients: [{id, name}] }`) and `POST` (create — body `{ name }`).
   - [ ] 3.2 Create `app/api/admin/clients/[id]/route.ts` with `PATCH` (rename — body `{ name }`) and `DELETE` (block if any `client_sets.client_id` references this id; otherwise cascades drones via FK).

4. [ ] **API routes — drones**
   - [ ] 4.1 Create `app/api/admin/clients/[id]/drones/route.ts` with `GET` (list drones for a client) and `POST` (add — body `{ serial }`).
   - [ ] 4.2 Create `app/api/admin/drones/[id]/route.ts` with `DELETE` (block if any `client_sets.drone_id` references this id).

5. [ ] **Header rename + new link**
   - [ ] 5.1 In `components/app-header.tsx`: rename the existing admin menu item label from `Admin` to `Users` (keep the `/admin` href and Settings icon). Add a new menu item below it: `Clients` linking to `/admin/clients`, also gated by `isAdmin`. Use the `Building2` lucide icon for it.

6. [ ] **Admin UI — list page**
   - [ ] 6.1 Create `app/(app)/admin/clients/page.tsx`: server component, redirects non-admin users back to `/`. Fetches all clients (admin client) and their drone counts. Renders the breadcrumb `Catalog > Clients` and delegates to a `ClientList` component for the list + inline create.
   - [ ] 6.2 Create `components/client-list.tsx` (mirror `family-grid.tsx`'s structure: card grid, inline create, inline rename, delete-with-confirm). Each card shows the client name + drone count and links to `/admin/clients/[id]`.

7. [ ] **Admin UI — detail page**
   - [ ] 7.1 Create `app/(app)/admin/clients/[clientId]/page.tsx`: server component, admin gate, breadcrumb `Catalog > Clients > {clientName}`. Fetches the client + its drones. Editable client name (inline) and a DroneList component beneath.
   - [ ] 7.2 Create `components/drone-list.tsx`: simple list of serials with inline add (`POST /api/admin/clients/[id]/drones`) and per-row delete (`DELETE /api/admin/drones/[id]`). Block-delete error surfacing if the drone is in use.

8. [ ] **Final pass**
   - [ ] 8.1 Run `node_modules/.bin/tsc --noEmit`; fix any errors.
   - [ ] 8.2 Smoke-test on Vercel preview: open `/admin/clients`, create a new client, rename it, add and remove drones, delete an unused client. Verify backfill: every existing non-Default `(client_name, serial)` is reachable as a `clients` + `drones` row, and the corresponding `client_sets.client_id` / `drone_id` columns are populated.
   - [ ] 8.3 Commit per logical chunk (migration, types, api, ui), push, watch Vercel preview build.

## Notes

- **Order of deploy is non-critical this stage**: the migration only adds new tables and *nullable* FK columns on `client_sets`. Old code keeps working because it doesn't reference them. Same playbook regardless: migration first via `supabase db push`, then push code.
- **Deletion safety**: blocking client/drone deletion when referenced by `client_sets` is intentional. Stage 04's upload flow will ensure new uploads always set the FKs, so deletes that look like they should work but fail will guide the user to remove the param sets first.
- **No UI changes outside of the new admin pages and the header**: the catalog, variant, client-set, version, compare, and filter pages are untouched. Stage 04 changes the upload flow to consume the new tables.
- **`is_default` boolean** is *not* added in this stage; Default detection still uses `serial = ""` per the variant page. Stage 05 needs the boolean for the role-aware RLS policy.
- **Empty serial = Default**: backfill skips `drones` row creation for these. `client_sets` for Defaults keep both new FKs NULL. Stage 05 will encode this rule explicitly with the `is_default` column.
- **MAVLink references** in `lib/mavlink-serial.ts` are unrelated protocol code; do not touch.
