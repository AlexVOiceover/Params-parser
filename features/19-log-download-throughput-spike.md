# 19 — Log Download Throughput Spike

A **throughput measurement spike**, not a feature. Before committing to a log-download UI, we need one number: the sustained KB/s of a MAVLink dataflash log transfer, measured on desktop *and* on Android-over-OTG. That number decides whether log download is a usable feature or a multi-hour endurance test, and it decides whether we use the simple `LOG_*` protocol or have to implement MAVFTP burst reads.

Deliverable is a throwaway page plus a measured number written back into this file. **No production UI, no catalog integration, no storage.** If the spike shows good throughput, the real feature becomes a later stage.

## The question

At our current `BAUD_RATE = 115200`, 115200 baud is ~11.5 KB/s raw, and `LOG_DATA` carries only 90 bytes of payload per frame. That projects to a 10 MB log in ~20 minutes and a 100 MB log in ~3.5 hours — unusable on a phone.

**The hypothesis worth testing:** the Cube Orange+ talks USB CDC, where the requested baud rate is conventionally ignored and the link runs at native USB speed. General USB CDC sources support this, but nothing authoritative confirms it for ArduPilot on the Cube, and ArduPilot's own throughput is bounded by its scheduler, not just the wire. **Measure, don't assume** — if real throughput is ~1 MB/s the whole objection collapses; if it really is ~8 KB/s, we need MAVFTP or an SD-card workflow instead.

## Scope

- **`lib/mavlink-log.ts`** (new): minimal log-transfer client.
  - Extend the `CRC_EXTRA` table with the authoritative values below. **This is the critical prerequisite** — `MavlinkSplitter.feed()` discards any frame whose `msgId` is absent from `CRC_EXTRA` (it can't verify the CRC, so it can't trust the frame). Without these entries every log message is silently dropped and the spike reads zero bytes.

    | Msg | ID | CRC_EXTRA | LEN |
    |---|---|---|---|
    | `LOG_REQUEST_LIST` | 117 | 128 | 6 |
    | `LOG_ENTRY` | 118 | 56 | 14 |
    | `LOG_REQUEST_DATA` | 119 | 116 | 12 |
    | `LOG_DATA` | 120 | 134 | 97 |
    | `LOG_REQUEST_END` | 122 | 203 | 2 |

  - `buildLogRequestList()` — `LOG_REQUEST_LIST` with start `0`, end `0xffff` to list all logs.
  - `buildLogRequestData(id, ofs, count)` — wire order is **`ofs` u32, `count` u32, `id` u16, `target_system` u8, `target_component` u8** (MAVLink orders fields by descending type size; do not use declaration order from the docs prose).
  - `parseLogEntry(payload)` — wire order **`time_utc` u32, `size` u32, `id` u16, `num_logs` u16, `last_log_num` u16**.
  - `parseLogData(payload)` — wire order **`ofs` u32, `id` u16, `count` u8, `data` u8[90]**.
  - Reuse the existing `buildV1`/`buildV2`, `x25crc` and `MavlinkSplitter` rather than duplicating frame logic. The splitter needs a hook to surface log messages alongside `params`/`statusTexts`.

- **`app/(app)/admin/log-spike/page.tsx`** (new, admin-only, temporary): the measurement harness.
  - Connect via the existing `requestDronePort()` shim, so the Android polyfill path is exercised unchanged.
  - List logs (`LOG_REQUEST_LIST` → `LOG_ENTRY`), showing id / size / UTC date.
  - Pick one log, transfer a **bounded slice** (default 1 MB, not the whole log) and report: **bytes transferred, elapsed seconds, sustained KB/s, frames received, frames lost/re-requested**, plus the detected serial mode (`native` / `polyfill`).
  - Discard the bytes. Measuring is the point; keeping them is a later stage.
  - Log every step to an on-screen log, as `ConnectDroneDialog` does — on Android the console is not reachable.

- **Protocol constraints to respect** (from ArduPilot's log-download docs):
  - **The vehicle must be disarmed**, or ArduPilot answers with a "Disarm for log download" STATUSTEXT and ignores the request. Surface that text — we already parse msgId 253.
  - **Only one `LOG_REQUEST_DATA` may be outstanding per link.** Extra requests are silently dropped while one is being serviced, so pipelining does not work; wait for each to finish or time out. This is the main throughput ceiling and the reason a naive implementation stalls.
  - **Do not treat a zero-`count` `LOG_DATA` as end-of-transfer.** ArduPilot only sends one when the offset is already at/beyond the log size; a final chunk that exactly fills the request produces no such message. Count bytes against the `LOG_ENTRY` size instead.
  - Re-request a lost chunk by asking for just that offset range. `LOG_REQUEST_END` is only needed to abort early.

- **Record the result in this file** under "Findings" — the numbers are the deliverable.

- **No DB changes.**

## Out of Scope for This Stage

- Any production log-download UI, progress bar, or entry point outside `/admin/log-spike`
- Saving logs to disk (File System Access API), to Supabase Storage, or to the catalog
- Resume-after-disconnect, retry loops, or robust gap recovery beyond what measurement needs
- **MAVFTP / `FILE_TRANSFER_PROTOCOL` burst reads** — ArduPilot recommends these over `LOG_*` for speed, and from 4.8 logs appear under `@MAV_LOG`. Much more work (sessions, sequence numbers, 50 ms ACK timeouts, CRC32, gap tracking). Only justified if this spike proves `LOG_*` too slow — that is the decision this spike exists to inform.
- `REMOTE_LOG_DATA_BLOCK` live streaming, and `LOG_ERASE` (destructive, wipes all logs, cannot target one)
- Parsing `.bin` contents — we are moving bytes, not decoding them
- iOS. No WebUSB, no Web Serial, no workaround; `ConnectDroneDialog` already says so

## Open Questions

- **Does the polyfill sustain a saturated read?** Our param use case is a short burst of small frames. A multi-minute high-volume stream over WebUSB is a different regime, and Android aggressively backgrounds tabs — a screen-on requirement may be unavoidable.
- **Which Cube Orange+ port?** The board exposes SLCAN *and* MAVLink; desktop users already get a "pick the other port" hint. Android's picker shows raw USB interfaces, so expect the same ambiguity with less helpful labels.
- **Stage numbering:** PLAN.md already assigns Stage 19 to mission upload/download and Stage 20 to flight control. This file takes the next free `features/` number; renumber if it should slot in after those.

## Findings

_To be filled in by the spike._

| Platform | Serial mode | Baud requested | Bytes | Seconds | KB/s |
|---|---|---|---|---|---|
| Desktop (Chrome, Linux) | native | 115200 | | | |
| Android (Chrome, OTG) | polyfill | 115200 | | | |

**Verdict:** _`LOG_*` is viable / `LOG_*` too slow, need MAVFTP / not viable on phone._
