# 13 — Admin Capture of Field Versions

When a connected drone's `SCR_USER2` is ahead of the catalog (`versionStatus === "drone_ahead"`), an admin can capture the drone's current params as a new catalog version flagged for review. This creates a lightweight review queue so rogue field changes don't silently enter the catalog.

## Scope

- **DB migration**: add `needs_review BOOLEAN NOT NULL DEFAULT FALSE` to `param_versions`
- **Capture button**: in the import modal (`connect-drone-dialog.tsx`), when `drone_ahead` and user is admin/contributor — reads connected drone params, posts to a new `/api/admin/capture` route, creates a `param_versions` row with `needs_review=true` and `version_label=droneVersion`. Shows inline confirmation "Saved as vN — marked for review."
- **`/api/admin/capture` route**: accepts `{ clientSetId, versionLabel, params }`, inserts `param_versions` + `param_values`, returns the new version id
- **Admin alert badge**: on `AppHeader`, fetch count of `needs_review=true` rows (admin only), show a red dot badge, link to `/admin/review`
- **`/admin/review` page**: lists pending versions with client name, drone serial, version label, created date. Each row: Accept button (`needs_review=false`) and Discard button (delete row). "View params" link opens the existing compare page for that version.
- **Variant page**: versions with `needs_review=true` show an amber "Pending review" pill in the versions list alongside the version label

## Out of Scope for This Stage

- Two-person approval flow
- Email/push notifications to admins
- Flash engine improvements (Stage 14)
- Fleet bring-up wizard changes (Stage 15)
