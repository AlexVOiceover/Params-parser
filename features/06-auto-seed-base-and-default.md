# Plan — Auto-create Base variant + Default client_set, but only as seeds

Tighten the catalog creation flow so a new family is never empty and a new variant always has a Default to compare against. Crucially, auto-creation is a **seed**, not a constraint: the user can rename or delete what we created, and we never recreate them.

## Goal

- `POST /api/admin/families` creates the family **plus** a `Base` variant **plus** a `Default` client_set under that variant. One write per row, all from the same handler.
- `POST /api/admin/variants` creates the variant **plus** a `Default` client_set under it.
- Renaming or deleting any of those auto-created rows leaves them renamed/deleted forever — no recreation on next visit.

## Why

- Removes the "create family, then create Base variant, then create Default param set" three-click sequence that every new family currently goes through.
- Makes the convention (every variant has a `Default` to diff client sets against) visible in code instead of being a tribal habit.
- Eliminates the awkward empty state on new variants where the diff column reads "no Default to compare".

## Rules

- **Auto-creation only fires once per parent.** The variants and client_sets POST routes already exist for manual creation; they're untouched. The auto-creation lives only inside the parent's POST route.
- **No "ensure Default exists" reconciler anywhere else.** Pages that rely on a Default keep their existing fallback ("no Default to compare yet") for variants where the Default was deleted on purpose.
- **Don't enforce by trigger.** Done in app code so it's visible, overrideable, and debuggable. A future import/migration flow can bypass auto-creation by calling the lower-level routes directly.
- **Auto-created rows look identical to manually-created ones.** No `auto_created` flag, no special markers — just the seed values:
  - Variant: `name = "Base"`, no description.
  - Default client_set: `client_name = "Default"`, `serial = ""`, `client_id = null`, `drone_id = null`, `is_default = true`.
- **`is_default` is the canonical Default marker, not the name.** The user can rename `Default` → anything; the row still has `is_default = true` and the app still treats it as the variant's Default.

## Tasks

1. [ ] **Families POST: auto-create Base + Default**
   - [ ] 1.1 In `app/api/admin/families/route.ts`, after the family insert succeeds, insert a variant with `name = "Base"` and `family_id = newFamily.id`. If that fails, surface a non-fatal warning but keep the family — partial success is fine.
   - [ ] 1.2 After the variant insert succeeds, insert a client_set with the seed values listed above. Same partial-success policy.
   - [ ] 1.3 No change to the response shape; the page already refreshes after create.

2. [ ] **Variants POST: auto-create Default**
   - [ ] 2.1 In `app/api/admin/variants/route.ts`, after the variant insert succeeds, insert a client_set with the seed values. Partial-success.

3. [ ] **Audit: anything reading by literal name?**
   - [ ] 3.1 `grep -rn '"Default"' app components lib` and verify all hits are either (a) display copy (good), (b) write paths setting the seed value (good), or (c) read paths that should be using `is_default` instead. Fix any (c).

4. [ ] **Smoke test (manual)**
   - [ ] 4.1 Create a new family `Test`. Confirm: family appears, `/test` shows a `Base` variant, and `/test/<variantId>` shows a Default card with no versions.
   - [ ] 4.2 Rename the Default to `Reference`. Reload — it stays `Reference`, not `Default`. Diff label still says "differ from Default" (acceptable; the row is still `is_default=true`, even though the label hardcodes the word).
   - [ ] 4.3 Delete the auto-created Default. Reload — it stays gone. Don't recreate.
   - [ ] 4.4 Create a second variant manually under the same family. Confirm: a `Default` is auto-created for it (independent of the rename in 4.2 — that variant has no Default, this one does).
   - [ ] 4.5 Create a third variant, rename its Default, then create a fourth variant. The fourth should still get a `Default` (auto-creation is per-parent, not influenced by sibling renames).

5. [ ] **Optional follow-up — diff label**
   - [ ] 5.1 If the user renames the Default, the variant page card shows "X params differ from Default" — but the row in question may now be called `Reference`. Decide whether to change the label to "differ from base" or "differ from <renamed>". Out of scope for this stage; flag for later.

## Notes

- Migration: none. Existing families/variants stay as-is. The user can manually add a Base/Default to any orphan if they want.
- No DB column changes. `is_default` is already there from feature 04.
- The "partial success" policy for child inserts means: if the child insert fails (RLS, unique conflict, etc.), the parent row stays. The user sees the family/variant they created and can manually add the missing child. We surface the failure as a non-blocking warning — never roll back the parent. (Rationale: the user's primary intent is "create the family" — the auto-children are a convenience.)
- Out of scope: backfilling auto-children for existing families/variants that don't have them. Not worth the risk; users can do it manually.
