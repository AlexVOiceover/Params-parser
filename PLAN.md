01 Main page, hide protected if not in use. Icon to collapse like a side panel?

02 Installable app? log on the console last time params fetched


03 Direct drone connection via Web Serial API (read params without Mission Planner)

### Overview
Use the browser's Web Serial API to connect directly to the drone over USB or telemetry radio,
send a MAVLink PARAM_REQUEST_LIST command, and stream all PARAM_VALUE messages into the app.
Chrome/Edge desktop only (Web Serial is not supported in Firefox/Safari).

---

### Phase 1 — MAVLink parser library (`lib/mavlink-serial.ts`)

**MAVLink v2 frame structure** (what we need to parse):
  - Byte 0: `0xFD` (magic/STX)
  - Byte 1: payload length
  - Byte 2: incompat flags
  - Byte 3: compat flags
  - Byte 4: sequence number
  - Byte 5: system ID
  - Byte 6: component ID
  - Bytes 7–9: message ID (3 bytes, little-endian)
  - Bytes 10…(10+len-1): payload
  - Last 2 bytes: CRC (CRC-16/MCRF4XX seeded with a per-message-ID magic byte)

**PARAM_VALUE message (ID 22, 0x16)** payload layout (25 bytes):
  - Bytes 0–3: `param_value` (float32, little-endian)
  - Bytes 4–7: `param_count` (uint16 → use 2 bytes, padded to 4)
  - Bytes 6–7: `param_index` (uint16)
  - Bytes 8–23: `param_id` (char[16], null-padded ASCII)
  - Byte 24: `param_type` (uint8, MAVLink type enum)

  Note: MAVLink uses "wire reordering" (fields sorted by size, largest first). Actual byte
  offsets must be confirmed against the official ardupilotmega.xml / common.xml definition.

**PARAM_REQUEST_LIST message (ID 21, 0x15)** payload (2 bytes):
  - Byte 0: `target_system` (uint8, typically 1)
  - Byte 1: `target_component` (uint8, typically 1)

**PARAM_REQUEST_READ message (ID 20, 0x14)** payload (4 bytes):
  - Bytes 0–1: `param_index` (int16, -1 to request by name)
  - Byte 2: `target_system`
  - Byte 3: `target_component`
  - Bytes 4–19: `param_id` (char[16], only used if param_index == -1)

**CRC implementation:**
  - CRC-16/MCRF4XX algorithm
  - Seeded with a per-message "CRC_EXTRA" byte derived from the message XML definition
  - CRC_EXTRA for PARAM_VALUE = 220, for PARAM_REQUEST_LIST = 159, for PARAM_REQUEST_READ = 214
  - These are hardcoded constants (don't change between ArduPilot versions)

**What the module exports:**
  ```ts
  type MavlinkConnectionCallbacks = {
    onParam: (name: string, value: number, index: number, total: number) => void;
    onDone: (params: Param[]) => void;
    onError: (msg: string) => void;
    onProgress: (received: number, total: number) => void;
  };

  async function openDroneConnection(
    baudRate: number,
    callbacks: MavlinkConnectionCallbacks
  ): Promise<() => void>; // returns disconnect function
  ```

**Internal logic:**
  1. Call `navigator.serial.requestPort()` — browser shows COM picker
  2. `port.open({ baudRate })`
  3. Pipe `port.readable` through a byte accumulator (reassemble chunks into frames)
  4. On each valid frame: if message ID === 22, decode PARAM_VALUE, call `onParam`
  5. Also handle HEARTBEAT (ID 0) to confirm live connection before requesting params
  6. Send `PARAM_REQUEST_LIST` once a HEARTBEAT is received (or immediately after open)
  7. Track received indices in a `Set<number>`; once `param_count` is known, set a
     3-second inactivity timer that fires `PARAM_REQUEST_READ` for any missing indices
  8. Retry missing up to 3 times; then call `onDone` with whatever was received
  9. Release read lock and close port on disconnect

---

### Phase 2 — Connect dialog (`components/connect-drone-dialog.tsx`)

**Trigger:** A "Connect drone" button in the main toolbar (next to the existing file upload button).
Only render the button if `"serial" in navigator` (feature-detect Web Serial support).

**Dialog states:**
  - `idle` — baud rate selector (115200 default, also offer 57600, 921600) + "Connect" button
  - `picking` — waiting for user to pick a port in the browser's native picker (no UI needed)
  - `connecting` — "Waiting for heartbeat…" spinner
  - `downloading` — progress bar: "Reading params… 342 / 718"
  - `done` — "718 params loaded" + Close button
  - `error` — error message + Retry button

**Baud rate options to present:**
  | Label | Value | Typical use |
  |---|---|---|
  | 115200 (USB) | 115200 | Direct USB cable to flight controller |
  | 57600 (SiK radio) | 57600 | 3DR/RFD900 telemetry radio |
  | 921600 (fast) | 921600 | RFD900x / newer radios at high speed |

**On success:** call existing `setParams(loaded)` — the rest of the app (filter, groups,
protection list, export) requires zero changes since it already works on `Param[]`.

**Missing-param UX:** If retries still leave gaps, show a warning: "23 params missing —
try reconnecting" rather than silently dropping them.

---

### Phase 3 — Toolbar integration (`components/param-filter-app.tsx`)

- Add "Connect drone" button next to the Upload button (or replace it with a split button)
- Wrap in `typeof navigator !== "undefined" && "serial" in navigator` check so it
  renders only in Chrome/Edge (SSR-safe)
- The button opens `<ConnectDroneDialog>` as a controlled dialog (same pattern as
  the existing list-editor dialog)
- After successful param load, log to console panel: `Connected to drone — 718 params loaded`
- Show a "drone" source badge near the param count (so user knows params came from live
  connection, not a file) — optional cosmetic touch

---

### Phase 4 — (Optional / future) Write params back to drone

Once read is working, the inverse is possible:
- Send `PARAM_SET` (ID 23) for each modified param
- Drone echoes `PARAM_VALUE` to confirm each write
- This would allow the full workflow: connect → filter → write protected params back
  (currently the app only writes a filtered .param file, not to the drone directly)
- Scope this as a separate future feature; do not implement in this phase