# 07 Integer versions and SCR_USER2 injection

> Change version labels from `N.0` strings to plain integers throughout the stack, and inject `SCR_USER2 = <version>` into every .param file at upload time so drones self-report their current version.

## Tasks

1. [x] **DB migration: backfill and constrain version_label**
   - [x] 1.1 Migration written and applied.
   - [x] 1.2 Verified: all rows now `'1'`, `'2'` etc.

2. [x] **Validation: fix all N.N regex guards**
   - [ ] 2.1 `app/api/upload/route.ts` — change `/^\d+\.\d+$/` to `/^\d+$/` and update the error message to remove "1.0" example.
   - [ ] 2.2 `app/api/admin/param-versions/[id]/clone/route.ts` — same regex + message change.
   - [ ] 2.3 `components/upload-form.tsx` — both the submit-time guard and the inline validation hint.
   - [ ] 2.4 `components/catalog-upload-modal.tsx` — both regex occurrences.
   - [ ] 2.5 `components/param-version-list.tsx` — the `versionLabelValid` check and the `cloneVersionLabel` validation.

3. [x] **Auto-suggest: next version as plain integer**
   - [ ] 3.1 `components/param-version-list.tsx` — rewrite `nextVersions()`: remove minor logic, return `{ next: string }` where `next = String(latest_major + 1)` (or `"1"` if no versions). Remove the `nextMinor` state and the "Revision" button block entirely. Simplify `uploadVersionType` to just `boolean` (selected / not). Auto-select on open.
   - [ ] 3.2 `components/catalog-upload-modal.tsx` — change `setVersionLabel(\`${nextMajor}.0\`)` to `setVersionLabel(String(nextMajor))`. Remove any minor-version references.
   - [ ] 3.3 `components/upload-form.tsx` — change `setVersionLabel(\`${next}.0\`)` to `setVersionLabel(String(next))`.

4. [x] **Display: strip .0 from rendered version labels**
   - [ ] 4.1 Search all render sites for `version_label` / `v.version_label` / `pv.version_label` across `param-version-list.tsx`, `client-set-list.tsx`, `compare/page.tsx`, `[clientSetId]/page.tsx`, `[variantId]/page.tsx`. Wherever a version label is rendered, it now comes from the DB as a plain integer string — confirm no display code appends `.0` or wraps it in `${n}.0`.
   - [ ] 4.2 Version pill in `param-version-list.tsx` that shows `Version 1.0` → confirm it reads `v.version_label` directly (it should; the DB value drives it now).

5. [x] **SCR_USER2 injection at upload**
   - [ ] 5.1 In `app/api/upload/route.ts`, after `parseParamFile(fileText)` produces `paramValues`, upsert `{ name: 'SCR_USER2', value: versionLabel }` into the array — find and overwrite if it already exists, otherwise push. Do this before the `param_values` INSERT and before the file is stored to the bucket.
   - [ ] 5.2 Also rebuild the file buffer from the updated `paramValues` array before writing to storage, so the stored `.param` file itself contains `SCR_USER2`. Use `writeParamFile(paramValues)` (already in `lib/param-engine.ts` — check that it exists).

6. [x] **Smoke test (manual)** — verified by user after login fix.

7. [x] **Changelog + version bump**
   - [x] 7.1 v0.8.0 added to `lib/changelog.ts`.

## Notes

- `writeParamFile` may not yet exist in `lib/param-engine.ts` — search before assuming. If it doesn't, add it: iterate `paramValues` and render each as `NAME,VALUE\n`.
- After task 1 the DB enforces integer-only labels; tasks 2–3 must be done before any new uploads are attempted via the UI.
- The `nextVersions()` simplification in task 3.1 removes the concept of minor revisions entirely. The "Revision" button in `param-version-list.tsx` disappears. That's intentional per the design decision.
- Task 5.2 requires that the stored file and the DB `param_values` rows both agree on `SCR_USER2`. Store the updated buffer to avoid the file and DB diverging.
