# 01 — Rename Drone Types→Families and Param Sets→Variants

Rename the catalog hierarchy across the entire stack — database, API, types, components, routes, and UI copy — without changing any functionality. After this stage the app behaves identically to today, only the terminology changes. This unblocks Phase 2 (adding Client Param Sets) which depends on the cleaner naming.

## Scope

- **DB migration**: single SQL migration `supabase/migrations/<ts>_rename_to_families_variants.sql`
  - `ALTER TABLE drone_types RENAME TO families`
  - `ALTER TABLE param_sets RENAME TO variants`
  - Rename FK columns: `variants.drone_type_id → family_id`, `firmwares.drone_type_id → family_id`
  - Rename indexes (`idx_param_sets_*` → `idx_variants_*`, `idx_firmwares_drone_type` → `idx_firmwares_family`)
  - Drop and recreate RLS policies under the new table names with identical predicates
  - Keep `param_versions.param_set_id` column name as-is (Phase 2 renames it to `client_set_id`)
  - Storage bucket `param-files` and UUID-based object paths stay untouched

- **Types** (`lib/types.ts`):
  - `DroneType` → `Family`
  - `ParamSet` → `Variant` (rename `drone_type_id` field to `family_id`)
  - Update every importer

- **API routes** — rename folders and update Supabase queries:
  - `app/api/admin/drone-types/...` → `app/api/admin/families/...`
  - `app/api/admin/param-sets/...` → `app/api/admin/variants/...`
  - `.from("drone_types")` → `.from("families")`, `.from("param_sets")` → `.from("variants")`
  - `drone_type_id` → `family_id` in selects/inserts/filters
  - JSON keys: `droneTypes` → `families`, `paramSets` → `variants`
  - Audit and update every fetch call site

- **Page routes** (App Router segments):
  - `app/(app)/[droneSlug]/page.tsx` → `app/(app)/[familySlug]/page.tsx`
  - `app/(app)/[droneSlug]/[paramSetId]/page.tsx` → `app/(app)/[familySlug]/[variantId]/page.tsx`
  - Update destructured params and every `href` / `router.push` referencing the old shape

- **Components** — rename files and exported symbols:
  - `components/drone-type-grid.tsx` → `components/family-grid.tsx`
  - `components/param-set-list.tsx` → `components/variant-list.tsx`
  - `components/param-version-list.tsx` stays (next stage re-parents it)
  - Internal renames: `droneTypes`/`paramSets` → `families`/`variants`, `droneSlug` → `familySlug`, etc.

- **UI copy**: "Drone types" → "Families", "Param sets" → "Variants" (and singular forms) across catalog page heading, breadcrumbs, upload form labels, publish modal, filter app's catalog-source indicator. The filter app's source indicator becomes `{family} / {variant} / {version}`.

- **Verify**: `npm run build` clean. Smoke-test catalog → family → variant → versions, upload, compare, filter "Open in Filter" deep link, admin dashboard, against the live Supabase project.

## Out of Scope for This Stage

- Adding the new **Client Param Sets** layer between Variants and Versions — that's stage 02
- Renaming `param_versions.param_set_id` column — deferred to stage 02 where it becomes `client_set_id`
- Touching `lib/mavlink-serial.ts` references to `param_set` — those are MAVLink protocol identifiers, **unrelated** to our catalog table
- Storage path or bucket changes (none needed; UUIDs are opaque)
- Updating `data/protection-lists.json` group naming (param-domain copy, not catalog-domain)
- Memory files, scratchpad, or other informational docs
- Backwards-compatible URL redirects from old `/{slug}/{paramSetId}` paths — slugs are unchanged so existing bookmarks resolve naturally
