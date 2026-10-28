# 19 Log Download Throughput Spike

> Measure the sustained KB/s of a MAVLink dataflash log transfer on desktop and on Android-over-OTG. The number decides whether log download is usable at all, and whether `LOG_*` suffices or MAVFTP is required. Throwaway harness only — no production UI, no storage.

## Tasks

1. [x] **Extend the frame layer for log messages**
   - [x] 1.1 Add the five authoritative `CRC_EXTRA` entries to `lib/mavlink-serial.ts`: `117: 128` (LOG_REQUEST_LIST), `118: 56` (LOG_ENTRY), `119: 116` (LOG_REQUEST_DATA), `120: 134` (LOG_DATA), `122: 203` (LOG_REQUEST_END). Without these the splitter silently discards every log frame.
   - [x] 1.2 Add `logEntries: LogEntry[]` and `logData: LogChunk[]` to `SplitterResult`, and populate them in `MavlinkSplitter.feed()` alongside the existing `msgId === 22` / `253` branches.
   - [x] 1.3 Export `buildV1`/`buildV2` (or a small `buildFrame(msgId, payload, v1)` wrapper) so the log module reuses the existing frame builder and `x25crc` instead of duplicating them.

2. [x] **`lib/mavlink-log.ts` — log transfer client**
   - [x] 2.1 `buildLogRequestList(v1)` — `LOG_REQUEST_LIST`, start `0`, end `0xffff`, 6-byte payload: `start` u16, `end` u16, `target_system` u8, `target_component` u8.
   - [x] 2.2 `buildLogRequestData(id, ofs, count, v1)` — 12-byte payload in wire order: `ofs` u32, `count` u32, `id` u16, `target_system` u8, `target_component` u8.
   - [x] 2.3 `buildLogRequestEnd(v1)` — 2-byte payload, for aborting early.
   - [x] 2.4 `parseLogEntry(payload)` → `{ timeUtc, size, id, numLogs, lastLogNum }`, wire order `time_utc` u32, `size` u32, `id` u16, `num_logs` u16, `last_log_num` u16.
   - [x] 2.5 `parseLogData(payload)` → `{ ofs, id, count, data }`, wire order `ofs` u32, `id` u16, `count` u8, `data` u8[90]. Slice `data` to `count`.
   - [x] 2.6 Explicit exported return types; no `any`/`unknown` (project rule).

3. [x] **Transfer loop with measurement**
   - [x] 3.1 `listLogs(port, callbacks)` — send `LOG_REQUEST_LIST`, collect `LOG_ENTRY` until `num_logs` are seen or a timeout fires. Handle the empty case (one entry, id 0, `num_logs` 0).
   - [x] 3.2 `measureLogTransfer(port, id, byteLimit, callbacks)` — request sequentially, **one `LOG_REQUEST_DATA` outstanding at a time** (ArduPilot silently drops extras; pipelining does not work).
   - [x] 3.3 Stop on `byteLimit` reached, or bytes received === `LOG_ENTRY` size. **Do not** treat a zero-`count` `LOG_DATA` as end-of-transfer — a final chunk that exactly fills the request produces no such message.
   - [x] 3.4 Per-request timeout + re-request of the missing offset range; count retries as a reported metric.
   - [x] 3.5 Return `{ bytes, seconds, kbPerSec, frames, retries, serialMode }`.
   - [x] 3.6 Surface STATUSTEXT verbatim — ArduPilot answers an armed vehicle with "Disarm for log download" and otherwise stays silent.

4. [x] **`/admin/log-spike` harness page**
   - [x] 4.1 Create `app/(app)/admin/log-spike/page.tsx`, admin-gated with the established pattern (`createSessionClient` → `profiles.role !== "admin"` → `redirect("/")`), plus `export const dynamic = "force-dynamic"` and a `metadata.title`.
   - [x] 4.2 Add `app/(app)/admin/log-spike/loading.tsx` built from `SkeletonRows`/`SkeletonBlock` (project rule: every data-fetching route needs one).
   - [x] 4.3 Client component: Connect button via the existing `requestDronePort()` shim so the Android polyfill path is exercised unchanged; show the detected serial mode.
   - [x] 4.4 Log list — id, size, UTC date, with a Measure button per row.
   - [x] 4.5 Byte-limit selector (default 1 MB) so nobody accidentally starts a 100 MB transfer.
   - [x] 4.6 Results panel: bytes, seconds, **KB/s**, frames, retries, serial mode.
   - [x] 4.7 On-screen scrolling log as in `ConnectDroneDialog` — on Android the console is unreachable.
   - [x] 4.8 Discard transferred bytes; never accumulate the full log in memory.
   - [x] 4.9 `BusyButton` + `busyLabel` for every async action; `cursor-pointer` and `whitespace-nowrap` on interactive elements (project rules).

5. [ ] **Verify and record**
   - [x] 5.1 `npx tsc --noEmit` and `npm run build` clean.
   - [ ] 5.2 Measure on desktop Chrome with the Cube Orange+ (disarmed); record the numbers.
   - [ ] 5.3 Measure on Android Chrome over USB-OTG; record the numbers and whether the polyfill sustains a saturated read.
   - [ ] 5.4 Fill the Findings table in `features/19-log-download-throughput-spike.md` and state the verdict.
   - [ ] 5.5 No changelog entry or version bump — the harness is admin-only and temporary, not a user-facing feature.

## Notes

- **The hypothesis:** at 115200 baud with 90-byte `LOG_DATA` payloads, a 10 MB log takes ~20 min and 100 MB ~3.5 h. USB CDC conventionally ignores the requested baud and runs at native USB speed, which would collapse that — but nothing authoritative confirms it for ArduPilot on the Cube. Measure, don't assume.
- **The real ceiling may not be baud rate.** Only one `LOG_REQUEST_DATA` may be outstanding per link, so every 90-byte chunk costs a round trip regardless of link speed. If throughput is round-trip-bound, raising the baud rate will not help and MAVFTP burst reads become the only path.
- **Prerequisite, not optional:** `MavlinkSplitter.feed()` drops frames whose `msgId` is absent from `CRC_EXTRA`. Task 1.1 must land before anything else can read a single byte, and skipping it produces a silent zero-bytes result rather than an error.
- **Field order is by descending type size, not declaration order.** The docs' prose order is misleading; the layouts in tasks 2.2/2.4/2.5 come from the generated `c_library_v2` headers.
- **Vehicle must be disarmed** or ArduPilot ignores the request.
- The Cube Orange+ exposes SLCAN *and* MAVLink. Desktop users get a "pick the other port" hint; Android's picker shows raw USB interfaces with less helpful labels — expect retries.
- **Out of scope:** production UI, saving logs anywhere, resume-after-disconnect, MAVFTP, `REMOTE_LOG_DATA_BLOCK`, `LOG_ERASE`, `.bin` parsing, iOS.
- **Stage numbering:** PLAN.md assigns Stage 19 to mission upload/download and Stage 20 to flight control. This took the next free `features/` number and so collides with the plan — renumber if it should slot in after those.
