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

## Feature 20 — Chip-ID identity and desired-state config

### Setup needed
- Two drones you can plug in over USB (Cube, MAVLink 2 on the USB port).
- A staff account (admin or contributor) and a client account for one of the drones' clients.
- At least one existing drone record that is **not linked** yet (all records are unlinked right after release).

### Identity and linking
- [ ] Connect a drone: the modal shows **Chip ID** (24 hex) and **Firmware** (e.g. 4.5.7).
- [ ] Staff, unlinked chip: "Which drone is it?" picker appears; the record whose serial ends in `SCR_USER1` is pre-selected; Link → status appears without reconnecting.
- [ ] Client account, unlinked chip: shows "isn't set up for updates yet — contact AIR6", no picker.
- [ ] Fleet page: the drone shows its chip ID; another drone shows **Not linked**.
- [ ] Fleet page: link a drone by pasting the Mission Planner **Messages** line (`CubeOrangePlus xxxxxxxx xxxxxxxx xxxxxxxx`); then connect that drone in the app — it is recognised with the same chip ID.
- [ ] Linking a chip already linked to another drone is refused with the other drone's serial.
- [ ] Contributor trying to re-link an already-linked drone is refused; admin can re-link.
- [ ] Unlink from the Fleet page → connecting shows the picker again.

### Status and update popup
- [ ] Drone equal to its latest version → **In sync with vN**.
- [ ] Add a new version to the drone's history with a few params changed → reconnect → **AIR6 has an update for this drone** with the change list → Apply → each param is read back → **In sync**; the history page **Drone log** shows "vN applied · verified · <firmware> · by <user>".
- [ ] Change a param in Mission Planner → reconnect in the app → **Modified on the drone** with the exact param → Restore vN works.
- [ ] On a modified drone: **Save as new version** as admin → becomes the latest, drone shows **In sync**.
- [ ] Same as a client/contributor → version is **pending review**; drone shows "Saved as vN — waiting for review" until an admin accepts it.
- [ ] Saving a version from a drone no longer leaves "Update available" afterwards (the original bug).

### Safety
- [ ] Read drone A, swap to drone B without the unplug clearing the app (e.g. reload is not enough — use two USB ports), then Apply: refused with "This is not the drone that was read", nothing written.
- [ ] Version uploaded with firmware 4.5.x applied to a drone on 4.6.x: warning shown and the write button stays disabled until "I understand" is ticked.
- [ ] A param that needs a reboot (e.g. a `SERIALx_PROTOCOL`): after Apply, it reads back the new value and the apply is logged. If it reads back the old value until reboot, note it — open question in the spec.

### Bring-up
- [ ] Register a new drone with **Register & apply the Default**: calibration (`COMPASS_OFS*`, `INS_ACCOFFS*`) is untouched, the result is saved as v1, the Drone log shows "linked at assembly" and "v1 saved from the drone".
- [ ] **Register & keep current params**: nothing is written to the drone; its params become the next version.

---

*Add new entries here as features are shipped without immediate testing.*

### Port memory (no Chrome picker)
- [ ] After one connect, the button reads "Connect to CubeOrange+" and Chrome's picker does not open
- [ ] With both Cube ports granted (MAVLink + SLCAN), it still lands on the MAVLink one
- [ ] Mission Planner holding the port → falls back to the picker instead of hanging
- [ ] "Use a different port…" always opens the picker
- [ ] Apply/Restore writes also skip the picker
- [ ] Android (WebUSB): reconnects without the device picker

### Drone page live card (replaces the ghost-card list above)
- [ ] No drone read → "Plug <serial> in…" with Connect drone
- [ ] Connected and in sync → green "Connected and matching vN, its target"
- [ ] Changed on the drone → dashed "vN+1 · from the connected drone · not saved" with Show diff and Save (changelog required)
- [ ] Saving adds vN+1 and the drone shows as saved from the drone in its history
- [ ] Drone on an older version → amber "Install vN" banner
- [ ] Another drone connected → "The connected drone is X, not this one" with "Open X"
- [ ] Unlinked FC (staff) → "Link to <serial>"; record already linked → admin-only "Re-link"

---

## 0.25.0 — Drone-first redesign + security lockdown

### Before testing
- Test on this branch (`fix/security-lockdown`) with `npm run dev --turbopack`. It points at the live database, so saves and installs are real.
- The migration `20261116180000_security_lockdown.sql` is NOT applied yet. Apply it only after the code is deployed (see below).

### Navigation
- [ ] Signed out: every page redirects to /login and comes back to the same page after signing in
- [ ] Header shows Drones · Models · Review · Clients for admin; clients only see "My drones"
- [ ] Header chip: "Connect drone" → after reading, "<serial> · Up to date / Update to vN / Changed on drone"; clicking it opens that drone; ↻ reads again
- [ ] Old links redirect: /AIR4Rugged → Models, /AIR4Rugged/<variant> → model page, /…/<client set> → drone page, /drone/<serial> (NFC) → drone page, /filter, /upload, /admin/drones → Drones

### Drones list
- [ ] Every drone listed with model, client, status, target, last verified; drones needing attention first
- [ ] Search and status chips filter; client filter works; Clients page "N drones →" opens the list filtered
- [ ] The connected drone shows a "connected" tag
- [ ] Add drone (serial, model, client, "start from template") opens the new drone's page with v1 copied from the template
- [ ] Client with one drone lands straight on its page; with several, sees only theirs

### Drone page
- [ ] History interleaves versions and log lines (installed, linked) newest first; the target has a "Target" badge
- [ ] "What changed" opens Compare with the previous version; "Compare versions" → tick two → Compare
- [ ] Download → Full file / Shareable (shareable has no COMPASS_, INS_ offsets, ATC_, RCn_MIN/MAX/TRIM, SRn_ …)
- [ ] Restore v2 → "Save as vN+1" → becomes the target (admin) or a proposal (client)
- [ ] Install button only on the target, only when this drone is connected and not on it
- [ ] Delete: a proposal can be deleted; a version a drone was verified on cannot (error explains)
- [ ] New version from file: diff vs target listed before saving; per-drone params hidden behind a checkbox; changelog required
- [ ] Settings: rename serial (URL follows), change client/model (admin), link FC, write NFC tag, delete drone

### Models
- [ ] Models list shows template version, proposals and drone counts; Add model (existing or new product line)
- [ ] Model page: template history with New version from file, Restore, Download; drones of this model; rename/delete (delete blocked while drones use it)

### Review
- [ ] Proposals show drone/template, author, note; Approve makes it the target; "Compare with vN"; Reject deletes it
- [ ] Approving an old proposal after a newer version was approved is refused with an explanation

### Per-drone params
- [ ] A drone that differs only in ATC_ gains, SRn_ rates or RC calibration shows as Up to date
- [ ] A drone whose SERIALn_ settings differ from its target now shows as changed, and Install writes them

### Security (after the migration is applied)
- [ ] A client cannot insert versions or drone-log rows through the Supabase API
- [ ] Stored-file URLs (…/storage/v1/object/public/param-files/…) return 400/404
- [ ] Downloads still work from the drone page

### Restored after review (2026-11-16)
- [ ] Filter in the header: load a file / the drone / a version ("Open in Filter" on a version card), protection lists, notes, export, Publish to Catalog (asks for a changelog, saves into the drone's history)
- [ ] Compare in the header: tree across all drones and templates; "Add a .param file…" adds a file column; "Add or change versions…" from a comparison keeps the current picks
- [ ] Version card: "Compare with…" opens the tree with that version ticked
- [ ] Version card: "Copy to…" → pick a drone or a model template → saved as its next version
- [ ] Drones list: Group by model / client (remembered), click column headers to sort
- [ ] Models list: edit name + description of a line or variant; delete a variant with no drones; delete an empty line
- [ ] Model page: description shown; Duplicate variant (copies the template history); each drone shows how many params differ from the template
- [ ] Drone page: description shown and editable in settings
