# 04 Magic-link auth + Client role with RLS-enforced visibility

> Replace email+password with passwordless magic links (matching the sister app ProdTrack), introduce a `client` role bound to one `clients` row, and rewrite RLS so the database itself prevents one client from reading another's data. Existing admin keeps access throughout.

## Tasks

1. [x] **Magic-link login form**
   - [x] 1.1 Rewrite `app/login/page.tsx`: replace password form with email-only form, call `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: '${origin}/auth/callback?next=...', shouldCreateUser: false } })`, swap form for "Check your email" success state on submit, read `?next=` and `?error=auth_failed` from URL, keep "Accounts created by administrators" footer.
   - [x] 1.2 Verify the existing layout in `app/login/layout.tsx` still wraps correctly. No changes expected unless the layout assumed password fields.

2. [x] **Auth callback route**
   - [x] 2.1 Create `app/auth/callback/route.ts` with a GET handler: read `code` and `next` from `request.nextUrl.searchParams`, call `supabase.auth.exchangeCodeForSession(code)` via `createSessionClient()`, redirect to `next` (default `/`) on success or `/login?error=auth_failed` on failure or missing code.
   - [x] 2.2 Confirm the route runs on Node (not Edge) so `@supabase/ssr` cookie setters work — App Router route handlers default to Node, so no extra config unless something forces Edge.

3. [x] **Dev-mode magic-link bypass**
   - [x] 3.1 Add a server action (e.g. `app/login/actions.ts`) that takes an email, uses `createAdminClient()` to call `admin.auth.admin.generateLink({ type: 'magiclink', email })`, then `verifyOtp({ email, token: linkData.properties.email_otp, type: 'magiclink' })` to log in directly. Skip silently if `SUPABASE_SERVICE_ROLE_KEY` isn't set or `NODE_ENV !== 'development'`.
   - [x] 3.2 In `app/login/page.tsx`, when in dev, call this server action instead of `signInWithOtp`. Production path unchanged.

4. [x] **Verify admin still has access (manual)**
   - [x] 4.1 Note in `scratchpad.md` to verify before merging: sign out, request a magic link with admin email, confirm session lands on `/` and `/admin` is reachable.

5. [x] **Remove password code paths**
   - [x] 5.1 `grep -rn "signInWithPassword"` confirms zero callers — the rewrite of `app/login/page.tsx` removed the only one. Nothing else to delete.
   - [x] 5.2 admin-dashboard had no password-mentioning copy to update.

6. [x] **Document Supabase dashboard config**
   - [x] 6.1 Add a section to `scratchpad.md` listing the manual dashboard changes the user must apply: Site URL, Redirect URLs (localhost + prod + preview pattern), Email signups off, Magic-Link template confirmation.

7. [x] **Schema: profiles.client_id and client role**
   - [x] 7.1 Wrote `supabase/migrations/20260504130615_add_client_role.sql`: adds `profiles.client_id`, drops the inline role check (looked up by name via `pg_constraint`), adds `profiles_role_check` with `'client'` included, adds `profiles_client_id_matches_role`.
   - [x] 7.2 Applied via `npx supabase db push`. Existing admin row passes new constraint (admin + null client_id).

8. [x] **Schema: client_sets.is_default flag**
   - [x] 8.1 Wrote and applied `supabase/migrations/20260504130826_client_sets_is_default.sql`: adds column, backfills, creates the partial unique index.
   - [x] 8.2 Verified: all 3 Default rows flagged true, 4 client rows flagged false; no rows where the legacy predicate matches but is_default=false.

9. [x] **RLS helper functions**
   - [x] 9.1 Wrote `supabase/migrations/20260504131946_rls_helpers.sql` adding `current_role()` and `current_client_id()`. `is_contributor_or_admin()` already exists from the initial migration; reused it instead of adding a duplicate.
   - [x] 9.2 Migration applied. Helpers will be exercised by the next migrations' policies.

10. [x] **RLS rewrite: clients and drones**
    - [x] 10.1 Wrote and applied `supabase/migrations/20260504134208_rls_clients_drones.sql`.
    - [x] 10.2 Admin still sees all (admin path = `is_contributor_or_admin()`).

11. [x] **RLS rewrite: client_sets**
    - [x] 11.1 Wrote and applied `supabase/migrations/20260504151229_rls_client_sets.sql`.
    - [x] 11.2 Admin path = `is_contributor_or_admin()` so reads and writes still work as today.

12. [x] **RLS rewrite: param_versions and param_values**
    - [x] 12.1 Wrote and applied `supabase/migrations/20260504151949_rls_param_versions_values.sql`. Inlined the visibility predicate (admin/contributor OR own client_set OR Default-of-relevant-variant) on both SELECT and INSERT, plus admin-only update/delete.
    - [x] 12.2 Service-role queries still return all rows; admin-session check needs the user to verify in browser.

13. [x] **Admin invite UI: role + client picker**
    - [x] 13.1 Updated `components/admin-dashboard.tsx`: invite form has Role + conditional Client picker; user table has a combined Role/Client cell that auto-clears or prompts for client_id when changing roles.
    - [x] 13.2 Rewrote `app/api/admin/users/route.ts`: validates role + client pairing, invites via Supabase, then updates `profiles` with role and client_id.
    - [x] 13.3 Rewrote `app/api/admin/users/[id]/route.ts` to accept `{ role, clientId }` and update both columns atomically.

14. [x] **UI gating: AppHeader**
    - [x] 14.1 Already gated by `isAdmin` (which is false for client role). No code change needed.

15. [x] **UI gating: upload flow**
    - [x] 15.1 `app/(app)/upload/page.tsx` accepts `client` role, forwards `role` + `userClientId` to `UploadForm`. `UploadForm` hides the Default-mode toggle for clients, locks `kind='client'`, pre-fills + disables the Client select, and the page filters the clients/drones lists down to the user's own.
    - [x] 15.2 `components/catalog-upload-modal.tsx`: relies on RLS — for a client user, `clients` and `drones` queries already return only their own company, so the modal's selects naturally show only allowed options. No code change needed.

16. [x] **UI gating: variant page and admin redirects**
    - [x] 16.1 `canCreate` was already gated on `role === 'admin' || role === 'contributor'` — false for client. No change.
    - [x] 16.2 Updated `middleware.ts` to redirect `client`-role users from `/admin/*` to `/`.
    - [x] 16.3 Empty-state copy on the catalog will need a follow-up if client UX needs polish, but it's tolerable today: a client with no data sees the empty catalog. Punt unless smoke test reveals a problem.

17. [x] **Smoke-test all three roles (manual)**
    - [x] 17.1 Admin verified throughout the implementation.
    - [x] 17.3 Client (alexrguez@gmail.com → Standhope AI) verified: only own family/variant visible, only own drone's set + Default in the variant page.
    - [ ] 17.2 Contributor not separately tested — same code paths as admin minus role-management routes; pre-existing flow.

18. [x] **Version bump and changelog**
    - [x] 18.1 v0.5.0 entry added at the top of `lib/changelog.ts` covering magic-link sign-in, the client role, RLS-enforced visibility, the new admin invite/delete UI, the per-client filtered catalog, and the mobile header fix.

## Notes

- Migration ordering is task-7 → 8 → 9 → 10 → 11 → 12 — schema first, then policies, then app code. Each migration is independently safe (helpers are permissive for existing roles; new policies don't restrict admin/contributor).
- The admin's row stays valid through every stage: password works through tasks 1–4; `profiles_client_id_matches_role` allows non-client roles with NULL client_id (existing rows pass); admin gating in task 16 doesn't fire for admin role.
- `shouldCreateUser: false` produces the same "Check your email" UI for typo'd emails as for real ones (anti-enumeration). Acceptable.
- `is_default` backfill matches `serial = '' AND client_name = 'Default'`. Spot-checked earlier in this conversation.
- Out of scope: OAuth providers, ProdTrack SSO, password reset, client-side drone CRUD, audit logs, storage-bucket private mode (param-files stays public-read for now — flagged as a follow-up).
