# Plan — Magic-link auth + Client role with RLS-enforced visibility

Two changes that share the same touch points (login, invites, profiles), so we ship them together:

1. **Replace email + password with magic links.** Same UX as the sister app (ProdTrack). Invite-only, no self-signup.
2. **Introduce a `client` role.** A user invited as `client` is bound to one row in `public.clients` and can only see/upload to that company's data. Enforced at the **database** (RLS), not just the UI — so a client user opening browser devtools and querying Supabase directly cannot read another company's drones or param sets.

Existing admin (`alexrodriguez@airborne-robotics.com`) keeps working throughout. No data migration; no change to `client_sets`, `param_versions`, etc. except adding one boolean column.

---

## Stage 1 — Magic-link login

**Goal:** the `/login` page is one email field and a "Send magic link" button. Clicking the email link signs the user in.

### 1.1 Login form

- File: [app/login/page.tsx](app/login/page.tsx). Drop the password input and the `signInWithPassword` call. Replace with:
  ```ts
  await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      shouldCreateUser: false,
    },
  });
  ```
- `shouldCreateUser: false` keeps invite-only behavior. Emails not already in `auth.users` get the same UI but no link is sent.
- After submit, swap the form for a "Check your email" success state, matching ProdTrack's copy.
- Read `?next=` from the URL and pass it through so deep-links work after sign-in.
- Show an inline error if `?error=auth_failed` is in the URL (the callback redirects there on failure).
- Keep the footer line: *"Accounts are created by administrators. No self-registration."*

### 1.2 Auth callback route

- New file: `app/auth/callback/route.ts`. GET handler. Reads `code` and `next` from the URL, calls `supabase.auth.exchangeCodeForSession(code)`, redirects to `next` (default `/`) on success, `/login?error=auth_failed` on failure.
- Adapted from ProdTrack's `src/routes/auth/callback/+server.ts`.
- No "first-time profile setup" detour — our `handle_new_user` trigger already populates `profiles`.

### 1.3 Dev-mode bypass (optional, ported from ProdTrack)

- In development, after the user submits their email, instead of mailing the link, use the service role to call `admin.auth.admin.generateLink({ type: 'magiclink', email })` and feed the returned `email_otp` straight into `verifyOtp`. Result: instant local sign-in, no inbox needed.
- Implemented as a server action so the service-role key never reaches the browser. Skips silently if `SUPABASE_SERVICE_ROLE_KEY` isn't configured.
- Production path is unchanged.

### 1.4 Remove password code paths

- After 1.1 lands, no callers of `signInWithPassword` remain. Verify with `grep`.
- No DB change — Supabase keeps the bcrypt hashes on `auth.users` but they become unused. (Reversible if needed.)

### 1.5 Supabase dashboard config (manual; document in `SCRATCHPAD.md`)

I cannot click these for you — they need the dashboard:

- Authentication → URL Configuration → **Site URL** = production origin (`https://air6params.vercel.app`).
- Authentication → URL Configuration → **Redirect URLs**: add `http://localhost:3000/auth/callback`, `https://air6params.vercel.app/auth/callback`, and the Vercel preview pattern (`https://*-alexrodriguez-7999s-projects.vercel.app/auth/callback`).
- Authentication → Providers → **Email** → "Enable email signups" off (we're invite-only).
- Authentication → Email Templates → **Magic Link**: confirm `{{ .ConfirmationURL }}` lands on `/auth/callback`.

### 1.6 Verify admin still has access

- Before this stage merges to main, sign out and request a magic link with the admin email; confirm the session lands on `/` and `/admin` is reachable.
- Fallback: the admin's password is still valid in the DB until 1.4 ships, so we can revert in a hotfix.

---

## Stage 2 — Schema changes for the `client` role

**Goal:** add the columns needed so a profile can be marked as a `client` user belonging to a specific company, and so RLS can cleanly identify the per-variant Default.

### 2.1 Migration

```sql
-- profiles: add client_id and broaden the role check
ALTER TABLE public.profiles
  ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('viewer', 'contributor', 'admin', 'client'));

-- A 'client' role MUST have a client_id; non-client roles MUST NOT.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_client_id_matches_role
  CHECK (
    (role = 'client' AND client_id IS NOT NULL)
    OR (role <> 'client' AND client_id IS NULL)
  );

-- client_sets: explicit Default flag (today identified by serial = '').
ALTER TABLE public.client_sets
  ADD COLUMN is_default boolean NOT NULL DEFAULT false;

UPDATE public.client_sets
  SET is_default = true
  WHERE serial = '' AND client_name = 'Default';

CREATE UNIQUE INDEX client_sets_one_default_per_variant
  ON public.client_sets (variant_id) WHERE is_default;
```

### 2.2 RLS helper functions

```sql
CREATE OR REPLACE FUNCTION public.current_role() RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT role FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.current_client_id() RETURNS uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT client_id FROM public.profiles WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION public.is_admin_or_contributor() RETURNS boolean
  LANGUAGE sql STABLE AS
$$ SELECT public.current_role() IN ('admin', 'contributor') $$;
```

`SECURITY DEFINER` is required because RLS policies can't query their own table — the helpers run as the function owner so they bypass the policy on `profiles`.

---

## Stage 3 — RLS rewrite (the security part)

**Goal:** the database itself refuses to return another company's data, no matter how the request is made (server, browser, raw API call).

This stage is one migration. Each policy has the same shape: admins/contributors see everything, clients see only their stuff.

### 3.1 `clients` and `drones`

```sql
DROP POLICY IF EXISTS clients_select ON public.clients;
CREATE POLICY clients_select ON public.clients FOR SELECT USING (
  public.is_admin_or_contributor()
  OR id = public.current_client_id()
);

-- Mutation stays admin-only (matches today).
DROP POLICY IF EXISTS clients_modify ON public.clients;
CREATE POLICY clients_modify ON public.clients FOR ALL USING (
  public.current_role() = 'admin'
) WITH CHECK (public.current_role() = 'admin');
```

```sql
CREATE POLICY drones_select ON public.drones FOR SELECT USING (
  public.is_admin_or_contributor()
  OR client_id = public.current_client_id()
);

CREATE POLICY drones_modify ON public.drones FOR ALL USING (
  public.is_admin_or_contributor()
) WITH CHECK (public.is_admin_or_contributor());
```

### 3.2 `client_sets` — the interesting one

A client user sees:
- their own company's `client_sets`, AND
- the per-variant `Default` for any variant where their company has at least one `client_set` (so they have something to compare against).

```sql
CREATE POLICY client_sets_select ON public.client_sets FOR SELECT USING (
  public.is_admin_or_contributor()
  OR client_id = public.current_client_id()
  OR (
    is_default
    AND EXISTS (
      SELECT 1 FROM public.client_sets cs
      WHERE cs.variant_id = client_sets.variant_id
        AND cs.client_id = public.current_client_id()
    )
  )
);

-- Insert: admins/contributors anywhere; clients only under their own client_id and a drone they own.
CREATE POLICY client_sets_insert ON public.client_sets FOR INSERT WITH CHECK (
  public.is_admin_or_contributor()
  OR (
    public.current_role() = 'client'
    AND client_id = public.current_client_id()
    AND EXISTS (
      SELECT 1 FROM public.drones d
      WHERE d.id = drone_id AND d.client_id = public.current_client_id()
    )
    AND is_default = false
  )
);

CREATE POLICY client_sets_update ON public.client_sets FOR UPDATE USING (
  public.is_admin_or_contributor()
);

CREATE POLICY client_sets_delete ON public.client_sets FOR DELETE USING (
  public.current_role() = 'admin'
);
```

### 3.3 `param_versions` and `param_values`

These don't need their own client-id check — visibility piggybacks on `client_sets`:

```sql
CREATE POLICY param_versions_select ON public.param_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.client_sets cs WHERE cs.id = client_set_id)
);

-- Insert/update/delete already check via client_sets in current policies; tighten so clients can insert
-- but only for client_sets they're allowed to write to.
CREATE POLICY param_versions_insert ON public.param_versions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.client_sets cs WHERE cs.id = client_set_id)
);
```

(`SELECT 1 FROM client_sets …` re-runs RLS on `client_sets` because `param_versions` queries it through the policy chain — the user can't see a `param_version` whose parent `client_set` they can't see.)

`param_values` already joins through `param_versions` → `client_sets`; same pattern.

### 3.4 `families` and `variants`

Stay public-read. Catalog metadata is shared.

### 3.5 Smoke-test plan

After the RLS migration:
- As admin: full access (no regression).
- As contributor: same as admin for read, can't manage roles.
- As client (Stanhope AI test account): from the Supabase JS client in the browser, confirm:
  - `from('clients').select('*')` returns only Stanhope AI.
  - `from('drones').select('*')` returns only Stanhope AI's drones.
  - `from('client_sets').select('*').eq('variant_id', AIR4Rugged_Base)` returns Stanhope AI's set + the Default. `eq` on another variant where Stanhope AI has no set returns nothing.
  - `from('param_values').select('*').eq('param_version_id', someCgiVersionId)` returns nothing.

---

## Stage 4 — Admin invite UI: role + client picker

**Goal:** when an admin invites a user, they pick the role; if `client`, also the company.

### 4.1 Admin dashboard

- File: [components/admin-dashboard.tsx](components/admin-dashboard.tsx). Add to the "Invite user" form:
  - **Role** select (`admin` / `contributor` / `client`).
  - **Client** select — visible only when role is `client`. Required. Options come from `clients.name`.
- Existing user table: add a "Client" column (only populated for client-role users). Allow admins to change a user's role; if changing to `client`, force a client picker; if changing away from `client`, clear `client_id`.

### 4.2 Invite API

- File: [app/api/admin/users/route.ts](app/api/admin/users/route.ts). Accept `{ email, role, clientId? }`.
- Validate the role/client_id pairing matches the new check constraint.
- Call `admin.auth.admin.inviteUserByEmail(email)`.
- After invite returns the new auth user's `id`, update `public.profiles` with the chosen role and (if client) `client_id`. Done in one transaction so a half-invited user doesn't get stuck as `viewer`.

### 4.3 Role-change API

- File: [app/api/admin/users/[id]/route.ts](app/api/admin/users/%5Bid%5D/route.ts). Accept `{ role, clientId? }` and update both columns atomically. Same validation as 4.2.

---

## Stage 5 — UI gating for client users

**Goal:** a client user only sees the parts of the app that make sense for them. RLS already prevents them from *reading* forbidden data — this stage is about not showing dead links.

- **AppHeader** ([components/app-header.tsx](components/app-header.tsx)): hide "Users", "Clients & Drones" menu entries for `client` role.
- **Catalog home, family, variant pages**: no code changes needed — RLS filters the data they read. The catalog will simply show only the families/variants relevant to them. Verify the empty states render gracefully when a client has zero data ("Your account isn't linked to any drones yet — please contact your administrator.").
- **Variant page** ([app/(app)/[familySlug]/[variantId]/page.tsx](app/(app)/%5BfamilySlug%5D/%5BvariantId%5D/page.tsx)): the "Add client + drone" button is for admins/contributors. Add a `canCreate` check that's already wired through; ensure it's `false` for client role.
- **Upload page** ([app/(app)/upload/page.tsx](app/(app)/upload/page.tsx)): allowed for `client` role too (per the new requirement). But:
  - Default mode (Family + Variant) is hidden for client users — they don't upload Defaults.
  - Client mode is the only mode shown. The Client dropdown is forced to their own company (and disabled). The Drone dropdown shows only their own drones.
- **Catalog upload modal** ([components/catalog-upload-modal.tsx](components/catalog-upload-modal.tsx)): same restrictions — force client to their own company.
- **Admin pages**: middleware already redirects on `/admin/*` based on `getUser()`. Add a role check so client users get redirected to `/` (not just unauthenticated ones).

---

## Stage 6 — Verify everything

Manual smoke test as each role:
- **admin**: existing flows unchanged. Magic link sign-in works. Can invite all three roles.
- **contributor**: same as today. Magic link works.
- **client** (new test account, link to Stanhope AI):
  - Can sign in via magic link.
  - Sees only Stanhope AI's data in the catalog (and per-variant Defaults where Stanhope AI has a set).
  - Cannot reach `/admin/*` or `/admin/clients`.
  - Can upload to their own drones; can't pick Default mode; can't upload to a drone that isn't theirs.
  - Can compare their version against the Default.
  - Browser-console probe (`supabase.from('client_sets').select('*')`) returns only allowed rows.

Also bump version and add a CHANGELOG entry: "Magic-link sign-in; new client role with per-company access."

---

## Out of scope

- **OAuth providers** (Google etc.) — additive later.
- **Cross-app SSO with ProdTrack** — separate user pools per the earlier discussion. Could be revisited.
- **Password reset** — moot once passwords are gone.
- **Client users editing their own drone records** — admins/contributors still own drone CRUD. Clients only upload param sets to drones already registered for them.
- **Per-user audit log** — not needed yet.

---

## Notes / risks

- **`shouldCreateUser: false`** means a typo'd email gives the same "Check your email" UI as a real one (Supabase's anti-enumeration default). Acceptable.
- **The `is_default` migration** updates rows by `client_name = 'Default' AND serial = ''`. Confirm this matches every Default before running. (Spot-checked earlier in this session — looked clean.)
- **The check constraint `profiles_client_id_matches_role`** means existing rows MUST satisfy it before being added. Existing admins/contributors all have `client_id IS NULL` (column is brand new), so they pass. Verified before adding the constraint.
- **The admin's row stays valid** through Stage 1 (password still works) and through Stage 2 (constraint allows non-client roles with NULL client_id). Stage 5 doesn't gate `/admin/*` until after we've verified the admin can sign in via magic link. So at no point does the admin lose access.
- **Migration ordering**: 2 → 3 → app code. If the RLS migration runs before the new helper-function calls in app code, nothing breaks because `is_admin_or_contributor()` is permissive for existing roles. If app code ships before RLS, nothing breaks because RLS is still permissive. Either order is safe.
- **Storage bucket policies** for `param-files` aren't covered above. Currently public-read. We should make uploads RLS-checked and downloads use signed URLs, but that's its own piece of work and out of scope here. (Today, anyone with a bucket URL can read any param file. Worth flagging for a follow-up.)
