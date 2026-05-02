# 02 Add Client Param Sets

> Insert a `ClientSet` layer between Variant and Param Version. Hierarchy becomes `Family → Variant → ClientSet → ParamVersion`. Backfill a "Default" client set per existing variant so historical data is preserved.

## Tasks

1. [ ] **Database migration**
   - [x] 1.1 Write `supabase/migrations/<ts>_add_client_sets.sql`: create `client_sets` table (`id`, `variant_id` FK CASCADE, `name`, `description`, `created_by`, `created_at`, `updated_at`, `UNIQUE(variant_id, name)`) + `idx_client_sets_variant`. Enable RLS.
   - [x] 1.2 Re-parent param_versions: add `client_set_id`, backfill one "Default" client set per existing variant with versions reassigned, drop old `param_set_id` column, add `idx_param_versions_client_set`. Replace `UNIQUE(param_set_id, version_label)` with `UNIQUE(client_set_id, version_label)`.
   - [x] 1.3 Drop and recreate RLS policies: `client_sets_select_all` (public read), `client_sets_insert_contributor`, `client_sets_update_owner`, `client_sets_delete_admin`. Update `param_versions` insert/select policies to join through `client_sets → variants`. Update `param_values_select` similarly.
   - [x] 1.4 Apply migration via `npx supabase db push`. Verify with REST: `client_sets` returns rows, every variant has at least one default, every param_version has a `client_set_id`.

2. [x] **Lib types**
   - [x] 2.1 In `lib/types.ts`: add `ClientSet` interface (`id`, `variant_id`, `name`, `description`, `created_by`, `created_at`, `updated_at`). Update `ParamVersion`: rename `param_set_id` field to `client_set_id`. Update `CompareVersion`: add `clientName: string`.
   - [x] 2.2 Update every importer of `ParamVersion` to use the new field name. (Will be handled as those files get rewritten in tasks 4–10.)

3. [x] **API routes — new client-sets folder**
   - [x] 3.1 Create `app/api/admin/client-sets/route.ts` with `GET` (list by `variantId`) and `POST` (create — body: `variantId`, `name`, `description?`).
   - [x] 3.2 Create `app/api/admin/client-sets/[id]/route.ts` with `PATCH` (rename / update description) and `DELETE` (cascade versions + clean storage objects via the storage_path of every child param_version).
   - [x] 3.3 Create `app/api/admin/client-sets/[id]/clone/route.ts` — deep-clone a client set including all versions, copying storage objects to new paths under the new client-set id.

4. [x] **API routes — update existing**
   - [x] 4.1 `app/api/upload/route.ts`: replace `variantId` param with `clientSetId` for existing-clientset uploads. Add `mode=new-client-set` (creates a client set on the fly). Storage path becomes `<client_set_id>/<version_label>.param`. Update `param_versions` insert to set `client_set_id`.
   - [x] 4.2 `app/api/admin/param-versions/[id]/clone/route.ts`: target is now a client set. Accept `clientSetId` and `newClientSet?: { name, description? }` (replacing the old `variantId`/`newVariant` shape). Storage path uses the new client set id.
   - [x] 4.3 (Out-of-band but required for this stage to be consistent) `app/api/admin/variants/[id]/route.ts` DELETE — collect storage paths via the client_sets join. `app/api/admin/variants/[id]/clone/route.ts` — clone all client sets and their versions.

5. [x] **App Router — variant page becomes client-set list**
   - [x] 5.1 Replace `app/(app)/[familySlug]/[variantId]/page.tsx` content: query client sets for this variant (instead of versions), render via the new `ClientSetList` component. Breadcrumb stays `Catalog > {family} > {variant}`. Update metadata.

6. [x] **App Router — new client-set page (versions)**
   - [x] 6.1 Create `app/(app)/[familySlug]/[variantId]/[clientSetId]/page.tsx`: query the client set + its versions, render via `ParamVersionList` (now keyed by client set). Breadcrumb `Catalog > {family} > {variant} > {clientSet}`.

7. [x] **Components — new client-set-list**
   - [x] 7.1 Create `components/client-set-list.tsx` mirroring `variant-list.tsx`'s structure: card list, inline create with "Default" name suggestion when empty, inline rename, delete-with-confirm. Hits `/api/admin/client-sets`.
   - [x] 7.2 Hook the component into the variant page (task 5.1).

8. [x] **Components — version list re-parenting**
   - [x] 8.1 `components/param-version-list.tsx`: rename `variantId` prop to `clientSetId`. Update clone-dialog flow to pick a target client set (with optional inline "+ New client set"). Update "Open in Filter" deep link to include `&client=...`.
   - [x] 8.2 Update upload form inside the version list (the inline "Add version" UI) to send `clientSetId` instead of `variantId`, matching the API change in 4.1.

9. [x] **Components — upload flows**
   - [x] 9.1 `components/upload-form.tsx`: load client sets via the new GET. Add a "Client set" select between Variant and Version, with inline "+ New client set" affordance (sends `mode=new-client-set` and `name`). Update `/api/upload` form-data accordingly.
   - [x] 9.2 `app/(app)/upload/page.tsx`: fetch client sets alongside families and variants; pass into `UploadForm`.
   - [x] 9.3 `components/catalog-upload-modal.tsx` (filter → publish): keeps `mode=new` (creates variant + Default client set automatically); copy clarifies the auto-created Default.

10. [x] **Components — compare**
    - [x] 10.1 `app/(app)/compare/page.tsx`: extend tree fetcher to include client sets between variants and versions. Update `fetchCompareData` so each `CompareVersion` includes `clientName`. Update the local `FamilyNode/VariantNode/...` types to add a `ClientSetNode`.
    - [x] 10.2 `components/compare/version-tree.tsx`: render the extra nesting level (Family → Variant → ClientSet → Version). Add collapse state for client sets.
    - [x] 10.3 `components/compare/compare-table.tsx`: column header now shows client name as primary with family/variant as subtext.
    - [x] 10.4 `components/compare/compare-table-wrapper.tsx`: synthetic drone `CompareVersion` gets `clientName: "Connected drone"`.

11. [x] **Filter app**
    - [x] 11.1 `components/param-filter-app.tsx`: catalog-source indicator becomes 4-segment `{family} / {variant} / {client} / {version}`. Update prop type.
    - [x] 11.2 `app/(app)/filter/page.tsx`: extend `searchParams` with `client?: string`; pass into `ParamFilterApp` if present.

12. [ ] **Final pass**
    - [x] 12.1 Run `node_modules/.bin/tsc --noEmit`; fix any errors.
    - [x] 12.2 Grep audit: any leftover `param_set_id`, `paramSetId`, `variantId` where it should now be `clientSetId` (excluding the catalog tables themselves and MAVLink protocol code).
    - [ ] 12.3 Commit per logical chunk, push, watch Vercel preview build, smoke-test the full flow on the preview URL.

## Notes

- **Order of deploy is critical**: apply the migration *before* the code reaches main, otherwise old code reads `param_set_id` which no longer exists and prod 500s. Same playbook as Phase 1.
- **Storage paths**: existing files keep their `<old_variant_id>/<version_label>.param` paths (we don't move bucket objects). Only new uploads use the `<client_set_id>/...` shape. `param_versions.storage_path` is preserved through the migration.
- **Old URLs break**: `/{familySlug}/{variantId}/{versionId-or-label}` deep links no longer resolve since the version list moved one level deeper. Acceptable per scope.
- **MAVLink references** in `lib/mavlink-serial.ts` are protocol identifiers (`PARAM_SET` is a message), not catalog tables. Don't touch.
- **`/api/catalog/compare`** route was deleted in Phase 1 cleanup. No work here.
