# AIR6 Param Filter

A web app for filtering Mission Planner `.param` files before applying them to a drone fleet. Export your config from one drone, strip the parameters that must stay unique per drone (calibration, hardware IDs, RC setup), and apply only the safe changes to your target drones.

---

## Workflow

1. **Export from Mission Planner** — Config → Full Parameter List → Save to File
2. **Open the file** — click **Open .param File**
3. **Choose a protection list** — parameters split into Protected (removed) and Will Be Applied
4. **Adjust manually** if needed — use the Protect / Apply buttons to move individual params
5. **Save** — click **Save Filtered File**, then load it on the target drone via Mission Planner

---

## Protection Lists

Three lists are included. Rules can be `prefix` (matches any param starting with a string) or `exact` (matches one param by full name).

| List | Protects |
|---|---|
| Calibration | Compass offsets, IMU/accel/gyro calibration, baro ground pressure, AHRS trim |
| Hardware & Device IDs | Compass/IMU/baro device IDs, board type, serial number, system ID |
| RC Configuration | RC channels 1–16, RC channel mapping |

---

## Param Catalog

The catalog (`/catalog`) is publicly visible — no login required to browse and download param files.

### User roles

| Role | Can do |
|---|---|
| `viewer` | Browse catalog, use the filter tool. Default for all new accounts. |
| `contributor` | Everything above + upload new param sets and versions via `/upload` |
| `admin` | Everything above + publish/unpublish param sets, change user roles via `/admin` |

### Creating accounts

There is no self-registration. Accounts are created by an admin through the **Supabase dashboard**:

1. Go to **Authentication → Users** in your Supabase project
2. Click **Invite user** (sends a magic-link email) or **Add user → Create new user** (set email + password directly)
3. The user's profile row is created automatically on first sign-in (role defaults to `viewer`)
4. To promote them, sign in as an admin → go to `/admin` → change their role in the Users table

### Uploading param files

Contributors and admins see an **Upload** link in the toolbar and catalog header.

1. Choose **New param set** (first time for a config) or **Add version to existing**
2. Select drone type and firmware version
3. Enter a version label (e.g. `v1.2`) and optional changelog
4. Upload the `.param` file
5. An admin must publish it from `/admin` before it appears in the catalog

---

## Development

```bash
npm install
npm run dev --turbopack
```

### Environment variables

Create `.env.development.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### Deploy

Push to `main` — Vercel auto-deploys. Set the three env vars above in your Vercel project settings.
