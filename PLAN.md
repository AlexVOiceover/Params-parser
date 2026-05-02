# Plan — Clients, drones, and per-client roles

A small refactor in the header, then a new **Clients** entity, then a real **role-based access** model so client users can see their own params (and the variant Default they came from) but not other clients'.

The goal is to remove free-text in the upload flow (Client name + Serial) and replace it with proper dropdowns sourced from a new `clients` table and its child `drones` table. Same data; just structured.

---

## Stage 1 — Header dropdown rename

User dropdown in the AppHeader currently has a "Settings" button. Rename to **Users** since we're going to add more administration links beside it. No new functionality.

- File: `components/app-header.tsx`. Change the icon label `Settings` → `Users` and update the `href` if it changes (currently `/admin`, which itself manages users). Keep the icon (Settings cog or switch to `Users` icon — TBD).

---

## Stage 2 — Add a `clients` admin section

A new entry in the same dropdown: **Clients**. Sits alongside Users. Clicking it opens `/admin/clients`.

### 2.1 Schema

```sql
CREATE TABLE public.clients (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        UNIQUE NOT NULL,        -- e.g. "Acme Corp"
  created_by  uuid        REFERENCES public.profiles ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.drones (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid        NOT NULL REFERENCES public.clients ON DELETE CASCADE,
  serial     text        NOT NULL,
  created_by uuid        REFERENCES public.profiles ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, serial)
);

CREATE INDEX idx_drones_client ON public.drones (client_id);
```

RLS: admin/technician (see Stage 4) can read+write everything. Client users see only their own client and its drones (Stage 4 wires this up).

### 2.2 Routes & UI

- **`/admin/clients`** — list of clients with inline create. Click a client to open its detail page.
- **`/admin/clients/[clientId]`** — client name (editable), list of drones (serials), inline create/delete.
- API:
  - `GET /api/admin/clients` (list), `POST` (create)
  - `PATCH /api/admin/clients/[id]` (rename)
  - `DELETE /api/admin/clients/[id]` (cascades drones — block deletion if any client_set references the client; until Stage 3 backfill, no link to enforce yet)
  - `POST /api/admin/clients/[id]/drones` (add serial)
  - `DELETE /api/admin/clients/[id]/drones/[droneId]`

### 2.3 Backfill from existing `client_sets`

`client_sets` already has free-text `client_name` + `serial`. Migration creates one `clients` row per distinct `client_name` and one `drones` row per (client_name, serial) pair. Then we add `client_sets.client_id` and `client_sets.drone_id` columns and link them up. Free-text columns stay for one stage so we can verify, then drop them in Stage 3.

---

## Stage 3 — Switch upload flow to dropdowns

After Stage 2 backfill, `client_sets` has both the new FKs and the old text columns. This stage:

- Updates the upload form (`upload-form.tsx`) and Publish-to-Catalog modal (`catalog-upload-modal.tsx`) to use:
  - **Client** select (existing only, dropdown of `clients.name`)
  - **Drone** select (filtered by chosen client, options are `drones.serial`)
  - "+ New client" / "+ New drone" inline affordances → POST to the client/drone APIs, then refresh the dropdown.
- API `/api/upload`: takes `clientId` + `droneId` (or `clientName` + `serial` for inline-creates), looks up or creates the matching `client_set`, attaches the version.
- Variant page's `client-set-list.tsx`: source the autocomplete from `clients.name` instead of inferring from existing `client_sets`.
- Compare page, version-tree, source-indicator: read display values from `clients.name` + `drones.serial` (still surfaced as `clientName` / `serial` strings in `CompareVersion`).
- Drop `client_sets.client_name` and `client_sets.serial` columns once everything reads from the FKs. Migration verifies no row has null FKs first.

---

## Stage 4 — Roles & per-client visibility

### 4.1 Schema

`profiles` already has `role` (`admin` / `contributor` today). Extend:

```sql
ALTER TABLE public.profiles ADD COLUMN client_id uuid REFERENCES public.clients ON DELETE SET NULL;
```

Roles become:
- **admin** — full access (existing).
- **technician** — same access as today's contributor (read all, upload, manage variants/clients/drones). Replace existing `contributor` value with `technician` in a one-line migration.
- **client** — bound to a `profiles.client_id`. Read-only access scoped to their own client.

### 4.2 RLS rewrite

The interesting policies:

- `client_sets` SELECT: visible if `is_admin_or_technician()` OR `client_set.client_id == auth.uid()→profiles.client_id` OR `client_set` is the **Default** for a variant whose any client this user owns reads from.
- `param_versions` SELECT: piggybacks on `client_sets` visibility (already does, since it joins through `client_sets`).
- `clients` SELECT: admin/technician see all; client users see only their own row.
- `drones` SELECT: same.
- `families` / `variants`: stay public-read (catalog metadata is shared).

The "Default visible to anyone who owns a child" rule is the subtle one. Concretely: every Variant's Default `client_set` is exposed to any client user whose own client has at least one `client_set` under that Variant. In SQL the policy becomes:

```sql
CREATE POLICY "client_sets_select" ON public.client_sets FOR SELECT
USING (
  public.is_admin_or_technician()
  OR client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
  OR (
    is_default                              -- needs the boolean column from the suggested follow-up
    AND EXISTS (
      SELECT 1 FROM public.client_sets cs
      WHERE cs.variant_id = client_sets.variant_id
        AND cs.client_id = (SELECT client_id FROM public.profiles WHERE id = auth.uid())
    )
  )
);
```

(Today we identify Default by `serial = ""`; before this stage we should add an explicit `is_default boolean` column to make the policy clean.)

### 4.3 UI gating

- Catalog home: same content for everyone, but the family/variant counts a client user sees should reflect only their own client_sets + Defaults.
- Variant page: client users see only the Default + their own client's `client_sets`. The "Add client + drone" affordance is hidden.
- Upload, Admin, Clients pages: hidden from client users entirely.
- AppHeader: drop the Users / Clients menu items for client users.
- Login flow: post-login, show a different empty state ("No drones yet — your account isn't linked to a client") for unlinked client users. Admin invites them via `/admin` and sets `profiles.client_id`.

### 4.4 Admin invites

Existing admin dashboard's "Invite user" form gains:
- Role picker (`admin` / `technician` / `client`).
- When `client` is picked, a Client dropdown appears (required).
- When `admin` or `technician` is picked, the Client dropdown is hidden.

---

## Stage 5 — Cleanup & smoke tests

- Drop unused columns from earlier migrations (the free-text ones on `client_sets` after Stage 3 verifies the FKs).
- Manually walk through the whole flow as each role:
  - **admin** does everything.
  - **technician** can upload and manage but can't promote roles.
  - **client** sees only their own data + Defaults; cannot mutate.
- Update CHANGELOG.

---

## Out of scope (future stages)

- Client users adding their own drones / param sets directly. For now everything is admin/technician-driven; clients are pure consumers.
- Client-side comments/notes on param versions.
- Multi-tenant branding.

---

## Notes / Risks

- **Role migration**: renaming `contributor` → `technician` will break any code that hard-codes the string. Audit before the migration: `grep -rn '"contributor"' app components lib`. Update in lockstep.
- **`is_default` column**: today Default is identified by `serial = ""`. Stage 4's RLS policy needs a clean predicate, so add an explicit boolean column (`client_sets.is_default`) and backfill from `serial = ""` *before* the RLS rewrite. One per variant; enforce with a partial unique index.
- **Backfill ordering**: Stage 2 backfill creates `clients` + `drones` from `client_sets.client_name + serial`. Empty-serial Defaults get a synthetic drone? Or skip drone creation for Defaults entirely? Decision needed before Stage 2 lands. (Probably: Defaults aren't tied to a client at all — they belong to the variant. May need `client_sets.client_id` to be nullable, with `is_default = true` implying `client_id IS NULL`.)
- **Storage paths**: unchanged. `client_sets.id` is still the storage prefix.
- **Coordinate with Vercel**: same playbook as Phases 1–2. Schema migration first, then matching code deploy.
