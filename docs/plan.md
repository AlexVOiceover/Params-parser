# 17 Fleet Overview

> New `/admin/drones` page showing all registered drones across all clients in one table — serial, client, family/variant, catalog version, link to param set.

## Tasks

1. [ ] **Create `/admin/drones` page**
   - [ ] 1.1 Create `app/(app)/admin/drones/page.tsx` — server component, admin-only (redirect to `/` if not admin)
   - [ ] 1.2 Query: fetch all drones joined with `client_sets` (latest version), `variants`, `families`, `clients`
   - [ ] 1.3 Render a table: serial, client name, family/variant, catalog version (v1/v2/…), link to param set
   - [ ] 1.4 Sort by client name then serial; show "No client" for orphan drones
   - [ ] 1.5 Add breadcrumb: Catalog → Fleet

2. [ ] **Add Fleet link to admin user menu**
   - [ ] 2.1 In `app-header.tsx`, add a "Fleet" `<Link>` inside the `{isAdmin && ...}` block, between "Clients & Drones" and "Review queue"
   - [ ] 2.2 Use an appropriate icon (e.g. `Radio` or `Layers` from lucide-react)

3. [ ] **Typecheck**
   - [ ] 3.1 `npx tsc --noEmit` — fix any errors

## Notes

- The query needs: drones → client_sets (drone_id FK, non-default) → param_versions (is_latest) → variants → families; plus clients for live name
- Orphan drones have no client_set linked by drone_id — show serial and variant but "No client" and "—" for version
- The param set link URL is `/${family.slug}/${variant.id}/${client_set.id}` — only show when client_set exists
- Use the same admin auth pattern as other admin pages (check profile.role)
