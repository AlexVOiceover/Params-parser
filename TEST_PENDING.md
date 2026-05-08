# Pending Tests

Things to verify when you have time. Tick them off as you go.

---

## Feature 09 — Orphan drone Default tracking + Compare back-navigation

### Setup needed
- A drone registered in `/admin/clients` with a serial number (e.g. `22`) but **no client assigned** (orphan drone — exists in `drones` table, no `client_sets` row for it on the variant).
- The variant it belongs to must have a Default param set with at least one version uploaded.
- Connect that drone via USB and import its params.

### Things to test

**Orphan version tracking**
- [ ] After importing the drone, the **catalog home banner** shows: serial, "no client", catalog link, version status (up to date / update available).
- [ ] If the Default has a newer version than `SCR_USER2` on the drone, the banner shows `v1 → v2 Apply update`.
- [ ] Clicking **Apply update** from the banner writes the diff to the drone and button disappears.

**Import modal recap**
- [ ] After importing an orphan drone, the modal's "Drone identified" block shows `Client: No client assigned` (in muted italic).
- [ ] Version status line (up to date / update available) still shows correctly.

**Variant page**
- [ ] Navigate to the variant the orphan belongs to. The **Default card** gets the emerald green highlight and `your drone (no client)` badge.
- [ ] If drone is behind the Default, the Default card also shows the amber `Update available` badge.
- [ ] Client set cards (if any) are **not** highlighted (the drone isn't registered to any of them).

**Compare back-navigation**
- [ ] Open a client set version list (e.g. Alexander / v1 and v2). Enter compare mode, select both, click Compare.
- [ ] The Compare page breadcrumb reads: `Catalog > Family > Variant > ClientName · Serial > 2 versions`.
- [ ] Clicking any breadcrumb link navigates back correctly.
- [ ] When comparing versions from **different** client sets (use the version tree picker), breadcrumb shows `Catalog > Compare > 2 versions` (no specific back-link).

---

*Add new entries here as features are shipped without immediate testing.*
