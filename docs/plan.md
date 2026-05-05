# 06 Auto-seed Base variant and Default client_set

> A new family auto-creates a `Base` variant + a `Default` client_set under it. A new variant auto-creates a `Default` client_set. Auto-creation is a one-time seed: rename or delete sticks, we never recreate.

## Tasks

1. [x] **Families POST: auto-create Base + Default**
   - [x] 1.1 Family POST inserts a `Base` variant after the family commits.
   - [x] 1.2 And inserts a Default client_set under that variant. Both are non-fatal.
   - [x] 1.3 Response carries `warnings[]` for any partial-success info; page refresh unchanged.

2. [x] **Variants POST: auto-create Default**
   - [x] 2.1 Variant POST inserts a Default client_set under the new variant. Non-fatal.

3. [x] **Audit: anything reading by literal name?**
   - [x] 3.1 `client-set-list.tsx` was rendering Default cards as the literal "Default" string regardless of the actual `client_name`. Fixed to render `c.client_name` (so renames stick visually). Edit modal now exposes a Name field for Defaults.

4. [x] **Smoke test (manual)** — verified by user.

5. [x] **Version bump and changelog**
   - [x] 5.1 v0.7.0 entry added.

## Notes

- App-code level, not a DB trigger — visible, debuggable, overrideable.
- Partial-success policy: if a child insert fails, the parent stays. Surface a non-blocking error in the response so the UI can show a warning, but never roll back the parent.
- No DB column changes. `is_default` already exists.
- No migration. Existing families/variants without a Base or Default stay as-is.
- The diff label "X params differ from Default" hardcodes the word; if a user renames the Default the label becomes mildly misleading. Out of scope; flag for a later polish pass.
