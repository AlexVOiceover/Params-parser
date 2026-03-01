# AIR6 Param Filter — Supabase Integration Plan

## Overview

Migrate from Vercel KV (single-user, no auth) to Supabase (Postgres + Storage + Auth)
to support a shared param file repository with version control, multi-user access,
and proper authentication.

**Guiding principles:**
- Public read — anyone can browse and download param files without logging in
- Admin-created accounts only — no self-registration UI
- Generic protection lists are global (shared), not per-user for now
- Ship in phases — catalog first, auth and migration after, upload last
- Keep the existing filter tool working throughout; no big-bang replacements

---

## Architecture

### Services

| Service | Purpose | Replaces |
|---|---|---|
| Supabase Auth | Identity, sessions, roles | localStorage username |
| Supabase Postgres | Metadata, versions, protection lists | Vercel KV |
| Supabase Storage | `.param` file blobs | (new capability) |
| Vercel (hosting) | Next.js app, API routes | unchanged |

### Roles

| Role | Can do |
|---|---|
| Anonymous | Browse catalog, download any published param file |
| `viewer` | Same as anonymous + personal notes (future) |
| `contributor` | Upload param files, create versions for their own param sets |
| `admin` | Everything: publish/unpublish, manage users, manage global lists |

Admin creates all accounts manually via Supabase dashboard or a script.
No signup flow is built in the UI.

---

## Database Schema

```sql
-- Extends Supabase built-in auth.users
CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username    text UNIQUE NOT NULL,
  role        text NOT NULL DEFAULT 'viewer'   -- 'viewer' | 'contributor' | 'admin'
  created_at  timestamptz DEFAULT now()
);

-- Global and (future) per-user protection lists
-- Replaces Vercel KV entirely
CREATE TABLE protection_lists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  rules       jsonb NOT NULL DEFAULT '[]',  -- [{type: 'exact'|'prefix', value: string}]
  owner_id    uuid REFERENCES profiles,     -- NULL = global list (admin-managed)
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Drone type catalog
CREATE TABLE drone_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text UNIQUE NOT NULL,   -- 'x500', 'iris-plus'
  name        text NOT NULL,
  description text
);

-- Firmware versions per drone type
CREATE TABLE firmwares (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drone_type_id  uuid NOT NULL REFERENCES drone_types,
  version        text NOT NULL,      -- '4.5.7'
  release_date   date,
  UNIQUE (drone_type_id, version)
);

-- A named param configuration (the "document")
CREATE TABLE param_sets (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text,
  drone_type_id  uuid REFERENCES drone_types,
  firmware_id    uuid REFERENCES firmwares,
  published      bool NOT NULL DEFAULT false,
  created_by     uuid REFERENCES profiles,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- Versioned snapshots of a param set
CREATE TABLE param_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  param_set_id   uuid NOT NULL REFERENCES param_sets ON DELETE CASCADE,
  version_label  text NOT NULL,         -- 'v1.0', 'v1.2-hotfix'
  storage_path   text NOT NULL,         -- Supabase Storage key
  changelog      text,
  created_by     uuid REFERENCES profiles,
  created_at     timestamptz DEFAULT now(),
  is_latest      bool NOT NULL DEFAULT false
);
```

### RLS Policies (plain English)

```
protection_lists:
  SELECT  → everyone (anon + authenticated)
  INSERT  → admin only (for global lists)
  UPDATE  → admin only
  DELETE  → admin only
  [future] owner_id IS NOT NULL → owner can SELECT/UPDATE/DELETE their own rows

param_sets:
  SELECT  → everyone on published rows; contributor/admin see their own unpublished
  INSERT  → contributor + admin
  UPDATE  → owner (created_by) + admin
  DELETE  → admin only

param_versions:
  SELECT  → everyone (inherits param_set published status via join — handled in query)
  INSERT  → contributor (for their own param_sets) + admin
  UPDATE  → admin only (e.g. flip is_latest)
  DELETE  → admin only

profiles:
  SELECT  → owner sees their own row; admin sees all
  UPDATE  → owner can update username; admin can update role
```

### Storage Bucket

- Bucket name: `param-files`
- Public read: yes (matches the "anyone can download" rule)
- Path pattern: `{drone_type_slug}/{param_set_id}/{version_label}.param`
- Authenticated write only (contributors and admins)

---

## Environment Variables

```env
# Add to .env.local and Vercel project settings
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # server-side only, never exposed to client
```

---

## Phases

---

### Phase 1 — Supabase Project Setup

**Goal:** Supabase project exists, schema is applied, env vars are in place.
No app changes yet.

**Tasks:**
- [ ] Create Supabase project (free tier is fine to start)
- [ ] Write SQL migration files under `supabase/migrations/`
- [ ] Apply migrations via `supabase db push` (Supabase CLI is already installed)
- [ ] Create `param-files` Storage bucket, set public read policy
- [ ] Enable Email auth in Supabase dashboard (disable signup — admin-only)
- [ ] Add env vars to `.env.local` and Vercel project
- [ ] Seed initial data: drone types, firmwares, global protection lists

**Outcome:** Supabase is live with empty tables. App is untouched.

---

### Phase 2 — Param Catalog (public, read-only, no auth)

**Goal:** A `/catalog` page anyone can visit to browse and download param files.
Auth is not needed for this phase.

**New files:**
```
app/catalog/
  page.tsx                  — catalog home, lists drone types
  [droneSlug]/
    page.tsx                — param sets for a drone type
    [paramSetId]/
      page.tsx              — detail: versions, changelog, download button
lib/supabase/
  client.ts                 — browser Supabase client (anon key)
  server.ts                 — server Supabase client (service role for API routes)
app/api/catalog/
  route.ts                  — GET all published param sets
  [paramSetId]/route.ts     — GET versions for a param set
  [paramSetId]/download/[versionId]/route.ts  — signed URL or redirect to Storage
```

**Tasks:**
- [ ] Install `@supabase/supabase-js` and `@supabase/ssr`
- [ ] Create browser and server Supabase client helpers
- [ ] Build catalog index page (drone type cards)
- [ ] Build drone type page (list of param sets with firmware badge)
- [ ] Build param set detail page (version list, changelog, download)
- [ ] Add "Catalog" link to the existing toolbar

**Outcome:** Public catalog is live. Existing filter tool is completely unaffected.

---

### Phase 3 — Authentication

**Goal:** Contributors and admins can log in. Protected routes redirect unauthenticated
users. No self-registration.

**New files:**
```
app/login/
  page.tsx                  — email + password form (no signup link)
middleware.ts               — protect /admin/* and /upload/* routes
lib/supabase/
  middleware.ts             — Supabase session refresh helper for Next.js middleware
components/
  auth-provider.tsx         — wraps app, exposes session via context
  login-form.tsx            — email + password, magic link option
  user-menu.tsx             — replaces the current @username badge
```

**Tasks:**
- [ ] Add `middleware.ts` at project root for route protection
- [ ] Build `/login` page (email + password only; magic link optional)
- [ ] Replace `UsernamePrompt` + `localStorage` username with Supabase session
  - `lib/user-store.ts` → replaced by session from Supabase client
  - `AppContext` username field → comes from `session.user` or `profiles` row
- [ ] Update toolbar user badge to show logged-in user or "Sign in" link
- [ ] Admin creates first user via Supabase dashboard; no UI needed for this

**Outcome:** Real auth. Logged-in users see their name in the toolbar. Protected
routes work. Existing anonymous usage of the filter tool is unchanged.

---

### Phase 4 — KV Migration (protection lists)

**Goal:** Replace Vercel KV with Supabase Postgres for protection lists.
The existing list editor UI stays identical.

**Changed files:**
```
app/api/lists/[username]/route.ts   — rewrite GET/PUT to query Supabase Postgres
lib/app-context.tsx                 — update fetch calls if needed (URL stays the same)
```

**Tasks:**
- [ ] Seed global protection lists into `protection_lists` table (migrate from
  `data/protection-lists.json`)
- [ ] Rewrite `app/api/lists/[username]/route.ts` to:
  - GET: fetch global lists from Supabase (+ user's own lists if authenticated)
  - PUT: save user's lists to Supabase (authenticated only)
- [ ] Verify list editor still works end-to-end
- [ ] Remove Vercel KV env vars from project once confirmed working
- [ ] Remove `@vercel/kv` package

**Outcome:** One less service. KV is gone. Protection lists now persist in Postgres
with proper ownership. UI is visually identical.

---

### Phase 5 — Upload & Admin

**Goal:** Contributors can upload param files through the web UI. Admins can
manage users and publish/unpublish param sets.

**New files:**
```
app/upload/
  page.tsx                  — upload form (authenticated contributors only)
app/admin/
  page.tsx                  — user list, role management
  users/[id]/page.tsx       — edit user role
components/
  upload-param-form.tsx     — select drone type, firmware, name, upload .param file
  version-manager.tsx       — add new version to existing param set
```

**Tasks:**
- [ ] Build upload form: drone type select, firmware select, name, description,
  file picker, version label, changelog
- [ ] API route: `POST /api/upload` — validates auth, uploads file to Supabase Storage,
  inserts `param_sets` + `param_versions` rows
- [ ] Admin page: list all users, change role (viewer/contributor/admin)
- [ ] Admin page: publish/unpublish param sets
- [ ] Add "New Version" flow to param set detail page

**Outcome:** Full CRUD for the catalog. Contributors upload via browser.
Admins control visibility and user roles.

---

## File Structure After All Phases

```
app/
  api/
    catalog/                 — new: Supabase-backed catalog reads
    lists/[username]/        — modified: KV → Supabase Postgres
    param-definitions/       — unchanged (ArduPilot pdef.json cache)
    upload/                  — new: authenticated file upload
  admin/                     — new: admin dashboard
  catalog/                   — new: public param browser
  login/                     — new: auth page
  upload/                    — new: upload form
  page.tsx                   — unchanged (filter tool)
  globals.css                — unchanged
  layout.tsx                 — add AuthProvider
lib/
  supabase/
    client.ts                — new
    server.ts                — new
    middleware.ts             — new
  app-context.tsx            — modified: username from Supabase session
  param-engine.ts            — unchanged
  types.ts                   — add catalog types
  user-store.ts              — deleted (replaced by Supabase session)
supabase/
  migrations/
    001_initial_schema.sql
    002_rls_policies.sql
    003_seed_drone_types.sql
middleware.ts                — new: route protection
```

---

## What Does NOT Change

- The main param filter tool (`app/page.tsx` and all its components)
- The ArduPilot param definitions API route and caching
- The Tailwind theme, design tokens, component styling
- Vercel as the hosting platform

---

## Open Questions (decide before starting Phase 3)

1. **Magic link vs password?** Magic link (email only, no password to remember) is
   simpler for a small invited team. Password login is more familiar. Both can be
   enabled simultaneously.

2. **Username in profiles.** The current app uses a free-text username for KV keys.
   Should the `profiles.username` be auto-set from the email prefix on first login,
   or should admins set it manually?

3. **Notes persistence.** Currently `paramNotes` live in-memory only (no persistence).
   Worth adding a `param_notes` table in Supabase per user, or keep notes local/ephemeral?
