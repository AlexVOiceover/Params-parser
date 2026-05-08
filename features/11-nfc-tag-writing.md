# 11 — NFC Tag Writing (Android)

Let admins write a drone's serial number to an NFC sticker directly from the app on an Android phone, replacing the third-party NFC app currently used. Uses the Web NFC API (`NDEFReader`), available in Android Chrome 89+ only. iOS and desktop browsers do not support this API and the UI is silently hidden on those platforms.

## Scope

- **`lib/use-nfc.ts` hook**: wraps `NDEFReader`. Exposes:
  - `isSupported: boolean` — true only on Android Chrome with the API available; false on iOS, desktop, and non-Chrome Android.
  - `status: 'idle' | 'waiting' | 'success' | 'error'`
  - `errorType: 'permission_denied' | 'write_failed' | 'not_supported' | null`
  - `write(serial: string): Promise<void>` — constructs the NDEF message and requests the write. Encodes two records: (1) a URL record pointing to `https://air6params.vercel.app/drone/<serial>`, (2) a plain text record with the serial string as a fallback for generic NFC readers.

- **`components/write-nfc-button.tsx` component**: reusable button that calls `useNFC`. Props: `serial: string`. Renders nothing when `isSupported` is false. States: idle (shows "Write NFC tag" with icon) → waiting (pulsing "Tap phone to tag…") → success (green "Tag written") → error (amber error message with retry). Resets back to idle after 3s on success or on user retry.

- **`/drone/[serial]` deep-link page** (`app/(app)/drone/[serial]/page.tsx`): landing page when someone taps the NFC sticker. Looks up the serial in `drones` (case-insensitive). If found: redirects to `/{familySlug}/{variantId}` — the variant page for that drone. If not found: shows a "Drone not registered" message with a link to the catalog. No auth required (public page — the variant page itself enforces auth if needed). This makes the NFC URL immediately useful.

- **Integration point 1 — `/admin/clients` drone row**: add a small NFC icon button next to each drone's serial in the expanded client row. Admin-only. Clicking triggers `WriteNFCButton` in a small inline popover/tooltip rather than a full modal.

- **Integration point 2 — Register drone wizard** (`components/register-drone-modal.tsx`): after the "done" step, if `isSupported`, show a "Write NFC tag" button that lets the admin immediately write the tag before closing the wizard.

- **DB**: no schema changes. The serial is already in `drones.serial`.

- **Changelog + version**: v0.12.0.

## Out of Scope for This Stage

- iOS NFC writing — blocked by platform; not possible via web.
- Reading NFC tags to trigger drone lookup (scanning a sticker to identify a drone) — a future feature.
- Overwriting existing tag content or verifying what's on a tag before writing.
- Any changes to the NFC sticker hardware/format requirements.
- The `WriteNFCButton` appearing anywhere other than the two integration points above.

## Notes

- The `NDEFReader` global may not be present in TypeScript's lib — declare it with `declare class NDEFReader` or add `@types/web-nfc` if available. Prefer a local declaration to avoid a new dependency.
- The NDEF URL record must use the `https://` prefix in the URL value, not the `U` abbreviation byte that some libraries use. `NDEFWriter`-style APIs handle this automatically.
- `write()` should request a user gesture before calling `reader.scan()` — the permission prompt fires on the first `.write()` call so no extra permission step is needed.
- The `/drone/[serial]` page should use `createClient()` (anon) for the serial lookup since it's meant to be publicly accessible (the variant page will gate any sensitive content with auth).
- The inline popover for the admin clients row should close on outside click and not add significant DOM weight. A simple `useState` tooltip is fine — no need for a full modal.
