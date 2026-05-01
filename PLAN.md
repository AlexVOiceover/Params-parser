# Plan — Rename hierarchy and add Client Param Sets

## Goal

Restructure the catalog hierarchy:

**Before**
```
Drone Types  →  Param Sets  →  Param Versions
```

**After**
```
Families  →  Variants  →  (Client Param Sets)  →  Param Versions
```

Two distinct phases:
1. **Rename only** — `Drone Types → Families`, `Param Sets → Variants`. No new functionality, no schema reshape.
2. **New level** — introduce **Client Param Sets** as a child of Variants, owning the param versions.

Phase 1 must ship cleanly before Phase 2 starts. Each phase ends with a working app and a green deploy.

---

## Phase 1 — Rename

### 1.1 Database

Single migration: `supabase/migrations/<ts>_rename_to_families_variants.sql`

- `ALTER TABLE drone_types RENAME TO families;`
- `ALTER TABLE param_sets RENAME TO variants;`
- `ALTER TABLE variants RENAME COLUMN drone_type_id TO family_id;`
- `ALTER TABLE firmwares RENAME COLUMN drone_type_id TO family_id;`
- Rename indexes:
  - `idx_param_sets_drone_type` → `idx_variants_family`
  - `idx_param_sets_published` → `idx_variants_published`
  - `idx_param_sets_created_by` → `idx_variants_created_by`
  - `idx_firmwares_drone_type` → `idx_firmwares_family`
- Update RLS policy names + bodies that reference the old table names (see migration `20260301000002_rls_policies.sql`). Drop and recreate each policy under the new table name with the same predicates.
- Update `param_versions.param_set_id` references — for Phase 1 we keep the column name (it points at `variants` now). Phase 2 will rename it to `client_set_id` when the Client Param Sets layer is inserted.

Storage: bucket name stays `param-files`. Object paths today are `<param_set_id>/<version_label>.param` — these stay valid (UUIDs don't change). We just stop using "param_set" terminology in code; the path layout itself is opaque.

### 1.2 Code rename

**Tables/columns reference change**

Mechanical Supabase query updates in:
- `app/api/upload/route.ts`
- `app/api/admin/drone-types/route.ts` → move file/folder to `app/api/admin/families/...`
- `app/api/admin/drone-types/[id]/route.ts` → `app/api/admin/families/[id]/...`
- `app/api/admin/param-sets/route.ts` → `app/api/admin/variants/...`
- `app/api/admin/param-sets/[id]/route.ts` → `app/api/admin/variants/[id]/...`
- `app/api/admin/param-sets/[id]/clone/route.ts` → `app/api/admin/variants/[id]/clone/...`
- `app/api/admin/param-versions/[id]/clone/route.ts` (only references `param_set_id` field — update if column renamed)

Replace:
- `.from("drone_types")` → `.from("families")`
- `.from("param_sets")` → `.from("variants")`
- `drone_type_id` → `family_id`

**Types**

`lib/types.ts`:
- `DroneType` → `Family`
- `ParamSet` → `Variant` (rename `drone_type_id` field to `family_id`)
- Update everywhere `DroneType` / `ParamSet` is imported.

**Routes**

App Router segment rename:
- `app/(app)/[droneSlug]/page.tsx` → `app/(app)/[familySlug]/page.tsx`
- `app/(app)/[droneSlug]/[paramSetId]/page.tsx` → `app/(app)/[familySlug]/[variantId]/page.tsx`
- Update `params: { droneSlug }` → `{ familySlug }`, `paramSetId` → `variantId`.
- Update all hrefs and `router.push` calls: `/${droneSlug}` → `/${familySlug}`, `/${droneSlug}/${paramSetId}` → `/${familySlug}/${variantId}`.

**Components**

Rename files and exports:
- `components/drone-type-grid.tsx` → `components/family-grid.tsx`
- `components/param-set-list.tsx` → `components/variant-list.tsx`
- (no rename needed for `param-version-list.tsx` — that level keeps its name)
- Inside the renamed components: `droneTypes` → `families`, `paramSets` → `variants`, `droneSlug` → `familySlug`, etc.

**UI copy**

- "Drone types" / "Drone type" → "Families" / "Family"
- "Param sets" / "Param set" → "Variants" / "Variant"
- Breadcrumb on `/[familySlug]` reads `Catalog > {family.name}`.
- Breadcrumb on `/[familySlug]/[variantId]` reads `Catalog > {family.name} > {variant.name}`.
- Catalog page heading: `Drone types` → `Families`.
- Variant detail page heading: keep "Versions" subsection (Phase 2 changes this).
- Upload form labels: "Drone type" → "Family", "Param set name" → "Variant name".
- "Publish to Catalog" modal labels match.
- Filter app's Catalog-source indicator: `{drone} / {set} / {version}` becomes `{family} / {variant} / {version}` — update prop names in `param-filter-app.tsx`.

**API contracts (request/response keys)**

The `/api/admin/drone-types` and `/api/admin/param-sets` endpoints — rename the *paths* (above) and update any JSON keys:
- request body `name` / `description` / `drone_type_id` → still `name` / `description` / `family_id`
- response JSON: `droneTypes: [...]` → `families: [...]`, `paramSets: [...]` → `variants: [...]`
- Update every fetch call site to read the new keys.

Audit fetch calls:
```
grep -rn "fetch(\"/api/admin/(drone-types|param-sets)" components/ app/
grep -rn "(droneTypes|paramSets):" components/ app/
```

**Other**

- `CLAUDE.md` references "ArduPilot params" — unchanged. The data-model copy refers to "drone types" implicitly in `data/protection-lists.json` group naming — leave the param-domain terminology alone, only rename the catalog-domain.
- `memory/MEMORY.md` (per CLAUDE.md note) — out of scope; not touching memory files.
- `scratchpad.md`, `PLAN.md` — informational only.

### 1.3 Test plan for Phase 1

Local:
- `npm run build` passes.
- Catalog home `/` lists families with variant counts.
- `/{familySlug}` lists variants for that family.
- `/{familySlug}/{variantId}` lists versions (existing param_versions rows).
- Upload flow: contributor uploads a `.param` file as a new variant — succeeds, version appears.
- Compare page works (the version-tree query now reads from `families` / `variants`).
- Filter tool's "Open in Filter" link from a version still loads.
- Admin dashboard still works.

Deploy: green build on Vercel, smoke-test the same flows on `air6params.vercel.app`.

### 1.4 Phase 1 commit boundary

Single feature branch. One commit per logical unit:
1. Migration SQL
2. Type renames + lib changes
3. API route renames
4. Component renames + UI copy
5. Route segment renames + hrefs
6. Final pass (build/typecheck clean, copy audit)

Squash-merge as `refactor: rename Drone Types→Families, Param Sets→Variants`.

---

## Phase 2 — Add Client Param Sets

Inserts a new layer between Variant and Param Version. After Phase 2:

```
Family  →  Variant  →  ClientSet  →  ParamVersion
```

A **ClientSet** is a customer-specific configuration of a variant. Each ClientSet has its own version history (param_versions).

### 2.1 Schema

New migration: `supabase/migrations/<ts>_add_client_sets.sql`

```sql
CREATE TABLE public.client_sets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  uuid        NOT NULL REFERENCES public.variants ON DELETE CASCADE,
  name        text        NOT NULL,             -- client label, e.g. "Acme Corp"
  description text,
  created_by  uuid        REFERENCES public.profiles ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (variant_id, name)
);

CREATE INDEX idx_client_sets_variant ON public.client_sets (variant_id);
```

Re-parent param_versions:

```sql
ALTER TABLE public.param_versions
  ADD COLUMN client_set_id uuid REFERENCES public.client_sets ON DELETE CASCADE;

-- Backfill: create one default ClientSet per existing variant, point its versions at it
WITH inserted AS (
  INSERT INTO public.client_sets (variant_id, name, created_by, created_at)
  SELECT id, 'Default', created_by, created_at
  FROM public.variants
  RETURNING id, variant_id
)
UPDATE public.param_versions pv
SET client_set_id = inserted.id
FROM inserted
WHERE pv.param_set_id = inserted.variant_id;

ALTER TABLE public.param_versions
  ALTER COLUMN client_set_id SET NOT NULL,
  DROP COLUMN param_set_id;

CREATE INDEX idx_param_versions_client_set ON public.param_versions (client_set_id);
```

(The unique constraint `(param_set_id, version_label)` becomes `(client_set_id, version_label)` — drop and recreate.)

RLS on `client_sets`:
- SELECT: any authenticated user (read access mirrors variants).
- INSERT/UPDATE/DELETE: admin or contributor role.

### 2.2 Routes

New segment under variant detail:
- `app/(app)/[familySlug]/[variantId]/page.tsx` — currently shows versions. Change it to show **client sets** for that variant (with a "Default" client set always present after migration).
- `app/(app)/[familySlug]/[variantId]/[clientSetId]/page.tsx` — new. Shows the version history for that client set (the existing `param-version-list` UI moves here).

Route params: `{ familySlug, variantId, clientSetId }`.

Breadcrumbs:
- Variant page: `Catalog > {family} > {variant}` → lists ClientSets.
- ClientSet page: `Catalog > {family} > {variant} > {clientSet}` → lists Versions.

### 2.3 API

New routes:
- `POST /api/admin/client-sets` — create (body: `variant_id`, `name`, `description?`).
- `PATCH /api/admin/client-sets/[id]` — rename / edit description.
- `DELETE /api/admin/client-sets/[id]` — also removes versions + storage objects.
- `POST /api/admin/client-sets/[id]/clone` — duplicate a client set including all its versions (deep clone, copies storage objects to new paths).

Update existing:
- `/api/upload` — accept `client_set_id` in place of `param_set_id` (for existing-clientset uploads); accept `mode=new-client-set` to create one inline (mirrors the current `mode=new` for variants).
- Storage path layout: `<client_set_id>/<version_label>.param` (same shape, new owning UUID).
- `/api/catalog/compare` (if reintroduced) — adjust queries.
- Admin clone of a version — its parent is now a client set, not a variant.

### 2.4 UI

New component: `components/client-set-list.tsx` (mirror `variant-list.tsx`'s patterns: card list, inline create, inline rename, delete-with-confirm).

Updated:
- `variant-list.tsx` (already renamed in Phase 1) — clicking a variant card navigates to `/{familySlug}/{variantId}`, which now shows ClientSets, not Versions.
- `param-version-list.tsx` — its `paramSetId` prop becomes `clientSetId`. The "Open in Filter" deep-link search params (`drone`, `set`, `version`) gain a `client` param: `?drone=...&set=...&client=...&version=...`. The filter tool's Catalog-source indicator becomes 4-segment: `{family} / {variant} / {client} / {version}`.
- Upload form (`/upload`): adds a "Client" select between "Variant" and "Version", with an inline "+ New client" affordance.
- Catalog upload modal (filter → publish): same — adds Client field.
- Compare's version-tree: adds another nesting level. Tree layout becomes `Family → Variant → Client → Version` (currently 3-level: Drone → Set → Version).

### 2.5 Test plan for Phase 2

- Existing data: every old variant has exactly one "Default" client set; every existing version is reachable through it. No 404s on previously bookmarked URLs (after the route shape changes — old `/{slug}/{variantId}/{versionId-or-label}` deep links are not preserved; the version list now lives one level deeper. Acceptable since the shape is changing).
- Create a new client set under a variant; upload a version to it; download succeeds.
- Delete a client set with versions — confirmation, storage cleaned.
- Compare across versions in different client sets of the same variant.
- Open-in-Filter from a client-set version preserves all four labels in the source indicator.
- RLS: anon can read client sets; only contributor/admin can mutate.

### 2.6 Phase 2 commit boundary

Same feature-branch discipline. One commit per:
1. Migration (with backfill)
2. New API routes + upload route changes
3. Variant page → client-set list, new client-set route
4. `param-version-list` re-parenting + version-list page move
5. Upload form + publish modal changes
6. Compare tree depth + filter source indicator
7. Final build/test/copy pass

Squash-merge as `feat: add Client Param Sets layer`.

---

## Notes / Risks

- **Search-and-replace pitfalls**: `param_set` shows up in MAVLink-related code (`lib/mavlink-serial.ts`) referring to *protocol-level* param IDs — not our `param_sets` table. **Do not touch** those references. Audit grep results manually before bulk replacing.
- **Storage migration**: not needed in either phase. Phase 2 reuses existing UUID-keyed paths because each version row keeps its `storage_path` value through the schema change.
- **Old URLs**: Phase 1 changes `/{droneSlug}/...` to `/{familySlug}/...`. Slugs themselves are unchanged (we renamed columns, not values), so existing bookmarks like `/x500/abc123` still resolve as long as the slug `x500` remains in the `families.slug` column. Phase 2 changes URL depth — old bookmarks to a version page break. Acceptable.
- **Single-environment migrations**: apply each migration via the Supabase CLI / dashboard against the `bsbomnirdjjcyapjvovm` project. There's no separate staging DB.
- **Coordinate with Vercel deploys**: schema migration must land *before* the matching code deploy, otherwise the live site queries non-existent columns. Recommended order: (a) push migration via Supabase, (b) push code that depends on it. A short inconsistency window (~30s) is acceptable for a hobby project.
