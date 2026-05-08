# 11 NFC Tag Writing (Android)

> Write a drone's serial number to an NFC sticker from an Android Chrome browser, encoding a deep-link URL + plain text serial as an NDEF message. Silently hidden on iOS and desktop.

## Tasks

1. [x] **TypeScript NDEFReader declaration**
   - [ ] 1.1 Add a minimal `lib/nfc-types.d.ts` declaring the Web NFC API globals (`NDEFReader`, `NDEFWriteOptions`, etc.) so TypeScript doesn't complain. Use a local declaration rather than adding a new npm dependency.

2. [x] **`lib/use-nfc.ts` hook**
   - [ ] 2.1 Detect support: `isSupported` is true only when `typeof NDEFReader !== "undefined"` (Android Chrome). Return false on all other platforms.
   - [ ] 2.2 Implement `write(serial: string): Promise<void>`. Builds the NDEF message with two records: (a) URL record → `https://air6params.vercel.app/drone/<serial>`, (b) text record → the serial string. Calls `new NDEFReader().write(message)`.
   - [ ] 2.3 Expose `status: 'idle' | 'waiting' | 'success' | 'error'` and `errorType: 'permission_denied' | 'write_failed' | 'not_supported' | null`. Update status before/after the write call. Catch `NotAllowedError` → `permission_denied`; other errors → `write_failed`.
   - [ ] 2.4 Auto-reset `status` back to `'idle'` after 3 seconds on `'success'`.

3. [x] **`components/write-nfc-button.tsx` component**
   - [ ] 3.1 Renders `null` when `isSupported` is false (silent on iOS/desktop).
   - [ ] 3.2 Props: `serial: string`, optional `className?: string`, optional `label?: string` (default "Write NFC tag").
   - [ ] 3.3 Idle state: icon button or labelled button showing NFC icon + label.
   - [ ] 3.4 Waiting state: pulsing amber style + "Tap phone to tag…" text.
   - [ ] 3.5 Success state: green "Tag written ✓" for 3s then resets.
   - [ ] 3.6 Error state: amber error message ("Permission denied" / "Write failed") with a "Retry" link that resets to idle.

4. [x] **`/drone/[serial]` deep-link page**
   - [ ] 4.1 Create `app/(app)/drone/[serial]/page.tsx`. Public page (no auth gate — the destination page gates it). Uses `createClient()` (anon) to look up `drones` by serial (case-insensitive `ilike`).
   - [ ] 4.2 If drone found: look up its `variant_id` → variant's `family_id` → family's `slug`. Redirect to `/{familySlug}/{variantId}` with `redirect()`.
   - [ ] 4.3 If not found: render a simple "Drone not registered" page with a link to the catalog home.
   - [ ] 4.4 Add `export const dynamic = "force-dynamic"` since the serial lookup must be fresh.

5. [x] **Integration point 1 — `/admin/clients` drone row**
   - [ ] 5.1 In `components/clients-table.tsx`, in the expanded drone row where the serial is displayed, add a `WriteNFCButton` with `serial={d.serial}` after the serial text. Show only when the user is admin.
   - [ ] 5.2 Keep it compact — use a small icon-only variant without a text label in the row to avoid crowding. A tooltip on the button is sufficient.

6. [x] **Integration point 2 — Register drone wizard done step**
   - [ ] 6.1 In `components/register-drone-modal.tsx`, in the `stage === "done"` section, render a `WriteNFCButton` with the registered serial below the success message.
   - [ ] 6.2 Add a short explanatory line: "Write the serial to the NFC sticker on the drone" (only shown when `isSupported`).

7. [x] **Typecheck + build**
   - [ ] 7.1 `npx tsc --noEmit` — fix any type errors.
   - [ ] 7.2 `npm run build` — confirm clean.

8. [x] **Changelog + version bump**
   - [ ] 8.1 Add v0.12.0 entry to `lib/changelog.ts`.

## Notes

- `NDEFReader.write()` triggers the OS permission prompt automatically on first call — no separate permission-request step needed.
- The URL record value should be the full URL string (e.g. `"https://air6params.vercel.app/drone/AIR4-0426-0023"`). Set `recordType: "url"` in the NDEF record.
- The `/drone/[serial]` page lives inside the `(app)` route group so it inherits the app layout, but the serial lookup itself uses the anon client so unauthenticated users can land there from a tag tap.
- `clients-table.tsx` already imports drone data including `serial` — no additional fetching needed for integration point 1.
- The `WriteNFCButton` in the register wizard should be independent of the wizard's close flow — the user might want to write the tag and then close, or close without writing.
