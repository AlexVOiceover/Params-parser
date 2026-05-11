# 13 Admin Capture of Field Versions

> When a drone is ahead of the catalog, an admin can capture its params as a new `needs_review` version. A review queue lets admins accept or discard before it becomes part of the catalog.

## Tasks

1. [x] **DB migration — add `needs_review` column**
   - [x] 1.1 Run SQL: `ALTER TABLE param_versions ADD COLUMN needs_review BOOLEAN NOT NULL DEFAULT FALSE`
   - [x] 1.2 Update TypeScript types referencing `param_versions` to include `needs_review: boolean`

2. [x] **`/api/admin/capture` route**
   - [x] 2.1 Create `app/api/admin/capture/route.ts` — POST, admin/contributor only
   - [x] 2.2 Accept `{ clientSetId, versionLabel, params: { name: string; value: string }[] }` in body
   - [x] 2.3 Insert `param_versions` row with `needs_review=true`, `is_latest=false`
   - [x] 2.4 Bulk-insert `param_values` rows for the new version
   - [x] 2.5 Return `{ versionId }` on success

3. [x] **Capture button in import modal**
   - [x] 3.1 In `connect-drone-dialog.tsx`, show "Capture to catalog" button when `versionStatus === "drone_ahead"` and user role is `admin` or `contributor`
   - [x] 3.2 On click: POST connected drone params to `/api/admin/capture` with matched `clientSetId` and `droneVersion`
   - [x] 3.3 Show loading state, then inline "Saved as vN — marked for review" confirmation

4. [x] **Admin alert badge on AppHeader**
   - [x] 4.1 In `app-header.tsx`, fetch count of `needs_review=true` rows server-side (admin only)
   - [x] 4.2 Render a red dot badge with the count, linking to `/admin/review`

5. [x] **`/admin/review` page**
   - [x] 5.1 Create `app/(app)/admin/review/page.tsx` — server component, admin only
   - [x] 5.2 Fetch all `param_versions WHERE needs_review=true` joined with client_sets, clients, drones
   - [x] 5.3 Render table: client name, drone serial, version label, created date
   - [x] 5.4 Accept button → PATCH sets `needs_review=false` (reuse or extend existing param-versions API)
   - [x] 5.5 Discard button → DELETE removes version row (cascades to param_values)
   - [x] 5.6 View link → `/compare?v=<versionId>` to inspect params before deciding

6. [x] **Variant page — "Pending review" pill**
   - [x] 6.1 Include `needs_review` in the variant page's `param_versions` select query
   - [x] 6.2 Render amber "Pending review" pill next to version label when `needs_review=true`

## Notes

- Captured versions use `is_latest=false` — they don't affect update notifications until accepted
- Accept sets `needs_review=false` only; does NOT auto-promote to `is_latest` (admin does that separately)
- Reuse the paginated bulk-insert pattern from the existing upload API for param_values
- Role check: follow the pattern in other admin routes (check session user role)
