# 17 — Fleet Overview

A single admin page at `/admin/drones` showing all registered drones across all clients in one table. Gives admins a complete picture of the fleet — who owns what, what version each drone is on, and a direct link to each drone's param set — without having to dig through individual client rows.

## Scope

- **New page** `app/(app)/admin/drones/page.tsx` — server component, admin only
- **Table columns**: serial, client name, family / variant, catalog version (latest version label from the drone's `client_set`), link to param set page (`/[familySlug]/[variantId]/[clientSetId]`)
- **Data**: join `drones` → `client_sets` → `param_versions` (latest) → `variants` → `families` and `clients` for live names
- **Sorting**: default sort by client name, then serial
- **Admin menu link**: add "Fleet" entry to the admin section in the user menu dropdown (`app-header.tsx`), alongside Users / Clients & Drones / Review queue
- **No DB changes** — all data already exists

## Out of Scope for This Stage

- Filtering / search (can be added later)
- Live connection status (drones aren't permanently connected)
- Update available indicators (complex, requires matching against connected drone)
- Edit/delete from this page — use Clients & Drones for that
