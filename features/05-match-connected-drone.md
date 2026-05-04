# 05 — Match connected drone to catalog row

When a user plugs in a drone via the "Import from drone" flow, parse `SCR_USER1` from the imported params, find the matching drone in the catalog (within the user's accessible set), and surface the cross-information in the import modal and on variant pages.

The convention: `SCR_USER1` holds the trailing integer of the drone's serial. Examples — `AIR4-0426-0023` → `23`, `2012` → `2012`, `001` → `1`. Drones whose serial has no trailing digits cannot be matched.

## Scope

- **Serial parsing utility**: a `parseSerialId(serial: string): number | null` helper that extracts the trailing digits, returns `null` if none. Lives next to `parseParamFile` in `lib/`.
- **Match resolution**: after `Import from drone` finishes, given the imported params, find `SCR_USER1`, then query `drones` filtered by RLS (the user's accessible set) and look for a drone whose `parseSerialId(serial)` equals that value.
  - Zero matches → "drone not on the system"
  - One match → use it
  - More than one match → treat as ambiguous, same as no match (rare, but cleaner than picking arbitrarily)
- **Import-from-drone modal recap**: after the imported params are loaded, show a summary block at the bottom: drone serial, client name, family / variant. If no match, show "Drone not registered in the catalog."
- **Catalog highlight**: on a variant page, when the currently-connected drone matches one of the client_set cards (i.e. the matched drone's `client_set` for this variant exists), highlight that card visually (e.g. a "this drone" badge plus a stronger border accent). The highlight clears when the drone is unplugged or its params are cleared.
- **DB**: no schema changes. Match is computed at request time from the existing `drones.serial` and the imported params.

## Out of Scope for This Stage

- Editing `SCR_USER1` from the app or auto-writing it back to the drone — that's a future feature.
- Cross-variant detection ("you connected an AIR4Rugged but you're looking at AIR8"). Out of scope; the highlight only fires when you happen to be on the matching variant.
- Automatic redirect to the matching variant page on connect — out of scope; we just display the cross-info.
- Persisting "last connected drone" across reloads. The match lives only while the params are in memory.
- Handling collisions where two drones in the user's set parse to the same integer — treated as no match.
