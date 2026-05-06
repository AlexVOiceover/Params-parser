# 07 — Integer versions and SCR_USER2 injection

Simplify the version model from `N.0` strings to plain integers, and ensure every `.param` file stored in the catalog has `SCR_USER2` set to the version number. Both changes are prerequisites for the update-notification and flashing features in Stages 08–11.

## Scope

- **DB migration**: backfill `param_versions.version_label` from `'N.0'` → `'N'` (e.g. `'1.0'` → `'1'`, `'2.0'` → `'2'`). Add a `CHECK (version_label ~ '^\d+$')` constraint to reject decimal strings going forward. No other schema changes.

- **Validation regex**: change every `/^\d+\.\d+$/` guard to `/^\d+$/` across:
  - `app/api/upload/route.ts`
  - `app/api/admin/param-versions/[id]/clone/route.ts`
  - `components/upload-form.tsx`
  - `components/catalog-upload-modal.tsx`
  - `components/param-version-list.tsx`

- **Auto-suggest UI**: change `${nextMajor}.0` → `${nextMajor}` in:
  - `components/catalog-upload-modal.tsx`
  - `components/upload-form.tsx`
  - The `nextVersions()` helper in `components/param-version-list.tsx` (which currently computes major and minor; simplify to just the next integer)

- **Display**: strip `.0` from all version label renders in the catalog, compare page, version pills, breadcrumbs, version list. Check `param-version-list.tsx`, `client-set-list.tsx`, `compare/page.tsx`, `[clientSetId]/page.tsx`.

- **SCR_USER2 injection at upload**: in `app/api/upload/route.ts`, after the `.param` file is parsed into `paramValues`, upsert a `{ name: 'SCR_USER2', value: <version_label> }` entry — overwrite if already present, insert if missing. This happens before the param_values rows are inserted into the DB and before the file is stored. Every file in the catalog then always carries its version as a param, which the drone will write to itself when flashed.

- **Changelog + version bump**: v0.8.0.

## Out of Scope for This Stage

- Reading `SCR_USER2` from a connected drone (Stage 08).
- Update notifications or any comparison logic (Stage 08).
- The differential write engine or any flashing UI (Stages 10–11).
- Any changes to `SCR_USER1` handling.
- Supporting truly semantic minor versions (e.g. `1.3`). Integer-only is the decision.

## Notes

- The backfill migration strips the `.0` suffix only. Any `version_label` that isn't already `N.0` is left untouched (there shouldn't be any in practice).
- After the migration, the unique constraint `(variant_id, client_name, serial)` on `param_versions` is unaffected — `version_label` has its own unique constraint `(client_set_id, version_label)` which just needs integer values.
- The `nextVersions()` helper in `param-version-list.tsx` currently computes both major and minor for the "minor bump" feature in the version list. With integers-only, the minor path can be removed or kept as dead code; remove it cleanly.
- After migration, test that existing versions (`1.0`, `2.0`) render as `1`, `2` everywhere before shipping.
