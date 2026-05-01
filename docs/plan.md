# 01 Rename Drone Types → Families and Param Sets → Variants

> Rename the catalog hierarchy across DB, API, types, components, routes, and UI copy. Functionality unchanged. Unblocks Phase 2 (Client Param Sets).

## Tasks

1. [ ] **Database migration**
   - [x] 1.1 Write `supabase/migrations/<ts>_rename_to_families_variants.sql`: rename tables (`drone_types→families`, `param_sets→variants`), rename FK columns (`variants.drone_type_id→family_id`, `firmwares.drone_type_id→family_id`), rename indexes
   - [x] 1.2 In the same migration, drop and recreate every RLS policy on the renamed tables under their new names with identical predicates (read `20260301000002_rls_policies.sql` for the originals)
   - [x] 1.3 Apply the migration against the live Supabase project (`bsbomnirdjjcyapjvovm`) via dashboard or CLI; verify schema with a quick `select` against `families` and `variants`

2. [x] **Lib types**
   - [x] 2.1 In `lib/types.ts`: rename `DroneType` interface to `Family`; rename `ParamSet` interface to `Variant` and its `drone_type_id` field to `family_id`
   - [x] 2.2 Update every importer of `DroneType` / `ParamSet` to import the new names

3. [x] **API routes — folder rename and queries**
   - [x] 3.1 Move `app/api/admin/drone-types/` → `app/api/admin/families/` (with subfolders); update its `.from("drone_types")` calls to `.from("families")`, `drone_type_id` → `family_id`, response key `droneTypes` → `families`
   - [x] 3.2 Move `app/api/admin/param-sets/` → `app/api/admin/variants/` (with `[id]/`, `[id]/clone/` subfolders); update queries (`param_sets` → `variants`, `drone_type_id` → `family_id`) and response key `paramSets` → `variants`
   - [x] 3.3 Update `app/api/upload/route.ts` and `app/api/admin/param-versions/[id]/clone/route.ts` to use the renamed tables/columns (keep `param_versions.param_set_id` column name as-is per scope)

4. [x] **App Router page segments**
   - [x] 4.1 Move `app/(app)/[droneSlug]/page.tsx` → `app/(app)/[familySlug]/page.tsx`; update destructured params (`droneSlug` → `familySlug`), variable names, queries, and any inline labels
   - [x] 4.2 Move `app/(app)/[droneSlug]/[paramSetId]/page.tsx` → `app/(app)/[familySlug]/[variantId]/page.tsx`; update params and breadcrumb labels
   - [x] 4.3 Update `app/(app)/page.tsx` (catalog home) and `app/(app)/compare/page.tsx` to use new table names in queries and new copy in headings/breadcrumbs

5. [x] **Components — files and props**
   - [x] 5.1 Rename `components/drone-type-grid.tsx` → `components/family-grid.tsx`; rename exported `DroneTypeGrid` → `FamilyGrid`; rename props (`droneTypes` → `families`); update internal copy and add-form labels
   - [x] 5.2 Rename `components/param-set-list.tsx` → `components/variant-list.tsx`; rename exported `ParamSetList` → `VariantList`; rename props (`paramSets` → `variants`, `droneSlug` → `familySlug`); update internal copy
   - [x] 5.3 Update every importer of these renamed components

6. [x] **Other components — UI copy and queries**
   - [x] 6.1 `components/upload-form.tsx` and `components/catalog-upload-modal.tsx`: update field labels ("Drone type" → "Family", "Param set name" → "Variant name"), state variable names, fetch calls to renamed APIs, response-key reads (`droneTypes`/`paramSets` → `families`/`variants`)
   - [x] 6.2 `components/param-version-list.tsx`: update breadcrumbs/labels referencing "param set"; keep `paramSetId` prop name (column not renamed in this stage)
   - [x] 6.3 `components/compare/version-tree.tsx`: update tree-node copy and any "drone"/"param set" labels
   - [x] 6.4 `components/param-filter-app.tsx`: catalog-source indicator labels (`{drone} / {set} / {version}` → `{family} / {variant} / {version}`)

7. [x] **Hrefs and route references**
   - [x] 7.1 Audit and update every `href={...}` and `router.push(...)` referencing the old slug shape — most use template strings already, only labels and prop names change
   - [x] 7.2 Update `?load=...&drone=...&set=...&version=...` query-param shape in deep links: rename `drone` → `family`, `set` → `variant` if surfaced as labels in the filter app's source indicator (props only — the URL keys can stay for back-compat or be renamed; pick one and apply uniformly)

8. [ ] **Final pass**
   - [x] 8.1 Run `node_modules/.bin/tsc --noEmit` and fix any type errors
   - [x] 8.2 Grep for residual `drone_types`, `drone_type`, `paramSets`, `ParamSet`, `DroneType` outside `lib/mavlink-serial.ts` (MAVLink protocol use is intentional); fix or note false positives
   - [ ] 8.3 Manually smoke-test locally: catalog home → family detail → variant detail → versions → upload flow → compare → filter Open-in-Filter deep link → admin dashboard
   - [ ] 8.4 Commit per logical chunk on the feature branch (migration, types, api, routes, components, copy/cleanup); push, open PR, watch Vercel preview build

## Notes

- Storage bucket `param-files` and UUID-keyed object paths are untouched.
- `param_versions.param_set_id` column stays named as-is — Phase 2 will rename to `client_set_id`.
- `lib/mavlink-serial.ts` references to `param_set` are MAVLink protocol identifiers, **not** our table; do not touch.
- `data/protection-lists.json` group naming is param-domain copy (ArduPilot params) — out of scope.
- Slugs (column values) are unchanged, so existing bookmarks like `/x500/abc123` continue to resolve.
- Schema migration must be applied **before** the matching code deploy lands in production. Order: (a) apply SQL via Supabase, (b) merge code PR. Brief inconsistency window is acceptable.
