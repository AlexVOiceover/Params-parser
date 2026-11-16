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
