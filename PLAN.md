# Android USB drone support

Goal: let users connect a flight controller to their Android phone via USB-OTG and read/write params from the existing app — no native app required.

## Decision

Use **WebUSB + `web-serial-polyfill`** as the primary path. When Chrome 148+ stable lands native Web Serial on Android (Q2 2026 per Google's roadmap), the polyfill becomes a no-op fallback automatically.

Why not wait for native Web Serial:
- Beta-only as of April 2026; gated to a "limited set of devices" initially.
- Polyfill works on every Android Chrome that supports WebUSB (years of stable history).
- Same `navigator.serial` interface — zero changes to our existing `openDroneConnection` / `writeDroneParams` code.

## Architecture

Single shim at app startup decides which `navigator.serial` to use:

```ts
// lib/serial-shim.ts
async function ensureSerial(): Promise<void> {
  if ("serial" in navigator) return;        // native (desktop, future Android)
  if (!("usb" in navigator)) return;         // not even WebUSB — give up
  const { serial } = await import("web-serial-polyfill");
  Object.defineProperty(navigator, "serial", { value: serial });
}
```

Call it from `PwaBootstrap` (already runs once on mount). Everything downstream of `navigator.serial` keeps working as-is.

## Step-by-step implementation

### 1. Install the polyfill

```bash
npm install web-serial-polyfill
```

Bundle size: ~10 KB gzipped. Lazy-loaded so desktop users never download it.

### 2. Create the shim

`lib/serial-shim.ts`:

```ts
let installed = false;

export async function ensureWebSerial(): Promise<"native" | "polyfill" | "unsupported"> {
  if ("serial" in navigator) return "native";
  if (installed) return "polyfill";
  if (!("usb" in navigator)) return "unsupported";
  try {
    const mod = await import("web-serial-polyfill");
    Object.defineProperty(navigator, "serial", { value: mod.serial, configurable: true });
    installed = true;
    return "polyfill";
  } catch {
    return "unsupported";
  }
}
```

Returns the active mode so the UI can adjust copy.

### 3. Wire it into the app

In `components/pwa-bootstrap.tsx` (or a new `<SerialShim />` client component):

```ts
useEffect(() => {
  ensureWebSerial();
}, []);
```

In existing `hasWebSerial` checks (e.g. catalog header, filter page), expand to:

```ts
const [serialMode, setSerialMode] = useState<"native" | "polyfill" | "unsupported">("unsupported");
useEffect(() => { ensureWebSerial().then(setSerialMode); }, []);
const hasWebSerial = serialMode !== "unsupported";
```

### 4. WebUSB device filter (polyfill only)

The polyfill calls `navigator.usb.requestDevice()` which needs a `filters` array. Without filters Chrome shows zero devices. Common ArduPilot USB IDs:

```ts
const ARDUPILOT_USB_FILTERS = [
  { classCode: 2 },                       // CDC class — catches every CDC-ACM device
  { vendorId: 0x1209 },                   // Generic / pid.codes (ArduPilot)
  { vendorId: 0x26ac },                   // 3DR (Pixhawk 1, Pixhawk Cube)
  { vendorId: 0x2dae },                   // Hex Technology (Cube Orange / Black)
  { vendorId: 0x0483 },                   // STMicroelectronics (most STM32-based FCs)
  { vendorId: 0x1a86 },                   // QinHeng CH340 (some clones)
];
```

The polyfill API: `polyfillSerial.requestPort({ filters: ARDUPILOT_USB_FILTERS })`. Native Web Serial has `serial.requestPort({ filters: [{ usbVendorId: 0x26ac }] })` — a slightly different shape, so we pass per-mode filters.

Update `mavlink-serial.ts` to accept and pass filters:

```ts
const filters = serialMode === "polyfill" ? ARDUPILOT_USB_FILTERS : [{ usbVendorId: 0x26ac }, ...];
port = await serial.requestPort({ filters });
```

### 5. UX adjustments for Android

Update `ConnectDroneDialog`:

- Detect mobile via `navigator.userAgent` or coarse pointer media query.
- Replace the existing "Connect your flight controller via USB" copy:
  - Mobile: **"Connect via USB-OTG cable. A USB-C-to-C cable will not work — you need an OTG adapter that puts the phone in host mode."** Link to a $5 OTG adapter on Amazon.
  - Desktop: keep current copy.
- After clicking Connect, browser shows USB device picker. First-time pick triggers a permission prompt; subsequent connects to the same device skip it.

### 6. Verify USB OTG / host mode

Phones without OTG support will throw immediately on `requestDevice()`. Handle gracefully:

```ts
try {
  port = await serial.requestPort({ filters });
} catch (e) {
  if (/host mode|not supported|not allowed/i.test(String(e))) {
    onError("This Android device does not support USB host mode (OTG). A native app is required.");
  } else {
    onError(`No port selected: ${e}`);
  }
}
```

### 7. Handle Android Chrome quirks

- **No `setSignals` on polyfill.** The polyfill exposes `setSignals` but it's a no-op on USB CDC-ACM. Our existing optional-chain (`port.setSignals?.()`) already handles this.
- **`bufferSize` is a hint, not a contract.** Some Android USB stacks ignore it. Our 16 KB hint is fine.
- **Read loop occasionally returns short chunks.** Already handled by `MavlinkSplitter`'s buffer-concat logic.
- **DTR/RTS does nothing** on most CDC-ACM connections — the FC doesn't need it asserted to start streaming.

### 8. PWA install on Android

Already covered by the existing PWA setup. Things to verify after install:

- USB device permissions persist across PWA launches (per-origin, in Chrome's storage).
- Service worker still registers in standalone mode.
- "Reuse previously-granted port" via `navigator.serial.getPorts()` works through the polyfill (it does — calls `navigator.usb.getDevices()` under the hood).

### 9. Testing matrix

| Device | Chrome version | Expected | Actual |
|---|---|---|---|
| Pixel 6+, Chrome stable | 145+ | Polyfill, works | TBD |
| Pixel 9, Chrome 148+ Beta | 148+ | Native Web Serial (Bluetooth only initially) — polyfill still used for USB | TBD |
| Samsung S22+, Chrome stable | 145+ | Polyfill, works | TBD |
| Cheap Android tablet w/o OTG | 145+ | Error message: "host mode not supported" | TBD |
| iPhone Safari | any | "Not supported — use Chromium browser" | TBD |

Hardware: AIR4Rugged or AIR8 with USB cable + USB-C OTG adapter ($3–10 online).

## Testing

Local dev tunnel for HTTPS (required for WebUSB):
```bash
npx cloudflared tunnel --url http://localhost:3000
```
Open the tunnel URL on the Android phone in Chrome → connect drone via OTG → tap "Import from drone".

For Vercel deployments: just open the production URL on the phone.

## Edge cases

- **iOS Safari**: no WebUSB / Web Serial roadmap. Show platform-detection message: "USB drone connection is not supported on iOS. Use Chromium-based browser on Android, Windows, macOS, or Linux."
- **Multiple FCs visible**: e.g., a Pixhawk + a USB-to-serial dongle plugged into a hub. Browser picker handles selection — we just pass filters.
- **Sleeping phone during long write**: Web Serial connection drops when screen sleeps. Document for users: keep screen on during writes (already done in our existing safety prompt, just expand wording).
- **PARAM_REQUEST_LIST flooding low-bandwidth Android USB**: not observed in practice — USB CDC-ACM is fast — but our existing batching (50 params per batch with 200 ms pause) is conservative and stays useful.
- **Permission revoke**: Chrome lets users revoke USB permission per-origin. App should handle the resulting `NetworkError` gracefully and re-prompt next connect.

## Order of work (~3 hours total)

1. Install `web-serial-polyfill` + write `serial-shim.ts` (15 min)
2. Wire shim into bootstrap + expand `hasWebSerial` checks (30 min)
3. Add USB filters and update `requestPort` calls (30 min)
4. Mobile-aware copy in `ConnectDroneDialog` (30 min)
5. Error handling: OTG-not-supported, permission-denied (30 min)
6. iOS detection + clear "unsupported" message (15 min)
7. Test on real Android device with a drone (30 min)

## Risks

- **Polyfill abandonment**: `web-serial-polyfill` is in `google/` org but lightly maintained. If it breaks on a future Chrome version, we'd need to fork. Low risk near-term — the WebUSB API surface is stable.
- **Native Web Serial supersedes polyfill mid-rollout**: when Chrome stable adds USB Web Serial on Android, the polyfill check (`"serial" in navigator`) means we use native automatically. Risk: native might pick a different default behavior (e.g., requiring filters, returning errors differently). Re-test when Chrome 150 lands.
- **FTDI-only USB radios won't work**: some old telemetry radios use FTDI chips, not CDC-ACM. The polyfill doesn't support FTDI. Direct flight-controller USB connections are CDC-ACM and unaffected. Document as a limitation.

## Out of scope

- Bluetooth telemetry on Android (Web Bluetooth or RFCOMM via Web Serial). Possible future work but adds significant UX complexity (pairing, signal-strength UI).
- iOS support. Would require either a native app or waiting for Apple to ship WebUSB (no roadmap).
