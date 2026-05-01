# 02 — Add Client Param Sets

Insert a new layer between Variant and Param Version: **Client Param Sets** (`client_sets`). After this stage the catalog hierarchy is `Family → Variant → ClientSet → ParamVersion`. Each Client Set is a customer-specific configuration of a variant with its own version history. Existing variants get a single "Default" client set during migration so no historical data is orphaned.

## Scope

- **DB migration**: `supabase/migrations/<ts>_add_client_sets.sql`
  - Create `client_sets` (`id`, `variant_id` FK CASCADE, `name`, `description?`, `created_by`, `created_at`, `updated_at`, `UNIQUE(variant_id, name)`) + `idx_client_sets_variant`.
  - Re-parent `param_versions`: add `client_set_id`, backfill one "Default" client set per existing variant with versions reassigned, drop `param_set_id`, add `idx_param_versions_client_set`.
  - Replace `UNIQUE(param_set_id, version_label)` with `UNIQUE(client_set_id, version_label)`.
  - RLS on `client_sets`: public SELECT; INSERT/UPDATE/DELETE require `is_contributor_or_admin()` (insert/update) or `is_admin()` (delete) — mirror the variants policy shape.
  - Update `param_versions` and `param_values` policies that previously joined through `variants` (via the old `param_set_id`) to now join through `client_sets → variants`.
  - Apply migration to live Supabase via `npx supabase db push` before merging code.

- **API routes**:
  - New: `POST /api/admin/client-sets`, `PATCH /api/admin/client-sets/[id]`, `DELETE /api/admin/client-sets/[id]` (cascades versions + cleans storage objects), `POST /api/admin/client-sets/[id]/clone` (deep-clone with storage copy).
  - `/api/upload`: accept `clientSetId` in place of `variantId`; `mode=new-client-set` creates one inline (mirroring the existing `mode=new` for variants). Storage paths become `<client_set_id>/<version_label>.param`.
  - `/api/admin/param-versions/[id]/clone`: target is now a client set, not a variant — accept `clientSetId` / `newClientSet`.

- **App Router**:
  - `app/(app)/[familySlug]/[variantId]/page.tsx` — change from version list to client-set list.
  - New `app/(app)/[familySlug]/[variantId]/[clientSetId]/page.tsx` — version history for that client set (the existing version-list UI moves here).
  - Breadcrumbs: variant page `Catalog > {family} > {variant}`; client-set page adds `> {clientSet}`.

- **Components**:
  - New `components/client-set-list.tsx` (mirror `variant-list.tsx`: card list, inline create, inline rename, delete-with-confirm).
  - `components/param-version-list.tsx`: `variantId` prop becomes `clientSetId`. Clone modal adds a Client Set picker. "Open in Filter" deep links gain a `client=...` query param.
  - `components/upload-form.tsx`: add a "Client Set" select between Variant and Version, with inline "+ New client set" affordance.
  - `components/catalog-upload-modal.tsx` (filter → publish): same Client Set field added.
  - `components/compare/version-tree.tsx`: render the extra nesting level (Family → Variant → Client → Version).
  - `components/compare/compare-table.tsx` and `compare-table-wrapper.tsx`: column header gains `clientName`; type `CompareVersion` adds a `clientName: string` field.
  - `components/param-filter-app.tsx`: catalog-source indicator becomes 4-segment `{family} / {variant} / {client} / {version}`.
  - `app/(app)/filter/page.tsx`: deep-link `searchParams` gains `client?: string`; pass into `ParamFilterApp`.

- **Verify**: `npm run build` + `tsc --noEmit` clean. Smoke-test on Vercel preview: catalog → family → variant (now lists client sets) → client set → versions; new client-set CRUD; upload to a specific client set; clone version across client sets; compare across versions in different client sets; "Open in Filter" preserves all four labels.

## Out of Scope for This Stage

- Multi-tenancy / per-client access control: client sets are visible to anyone who can see their parent variant (same as today). No client-scoped users or auth changes.
- A "client" entity separate from `client_sets` (i.e. one client owning multiple sets across variants). For now the **name** alone identifies the client; if a real Clients table is needed later, that's a future phase.
- Migrating storage object paths in the bucket — existing files keep their current `<old_variant_id>/<version_label>.param` paths; only **new** uploads use the `<client_set_id>/...` shape. Storage paths are referenced by `param_versions.storage_path`, which is preserved through the migration.
- Old URL preservation: `/{familySlug}/{variantId}/{versionLabel}` deep links from before this stage will 404 (the version list moved one level deeper). Acceptable.
- Cross-cutting renames inside `lib/mavlink-serial.ts` or `data/protection-lists.json` — protocol/copy domains untouched.
- Per-client-set comparison shortcuts in the UI (e.g. "compare all clients of this variant"). Phase 2 just enables the data model; Phase 3+ can add quality-of-life flows.
