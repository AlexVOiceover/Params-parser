/**
 * Serial transport shim — picks native Web Serial when available, otherwise
 * lazy-loads `web-serial-polyfill` which implements the same API on top of
 * WebUSB. Lets Android Chrome (which has WebUSB but not yet stable Web Serial)
 * use the same MAVLink code path as desktop.
 */

export type SerialMode = "native" | "polyfill" | "unsupported";

let installed = false;
let cachedMode: SerialMode | null = null;

export async function ensureWebSerial(): Promise<SerialMode> {
  if (typeof navigator === "undefined") return "unsupported";
  if ("serial" in navigator) {
    cachedMode = "native";
    return "native";
  }
  if (cachedMode === "polyfill" && installed) return "polyfill";
  if (!("usb" in navigator)) {
    cachedMode = "unsupported";
    return "unsupported";
  }
  try {
    const mod = await import("web-serial-polyfill");
    Object.defineProperty(navigator, "serial", {
      value: mod.serial,
      configurable: true,
    });
    installed = true;
    cachedMode = "polyfill";
    return "polyfill";
  } catch {
    cachedMode = "unsupported";
    return "unsupported";
  }
}

export function getSerialMode(): SerialMode {
  return cachedMode ?? "unsupported";
}

interface UsbFilter { usbVendorId?: number; usbProductId?: number; }

/**
 * USB device filters for ArduPilot-compatible flight controllers.
 * Used when running through the polyfill (WebUSB requires filters; without
 * them the device picker shows nothing).
 */
export const ARDUPILOT_USB_FILTERS: UsbFilter[] = [
  { usbVendorId: 0x1209 }, // Generic / pid.codes (community ArduPilot boards)
  { usbVendorId: 0x26ac }, // 3DR (Pixhawk 1, Pixhawk 2 Cube)
  { usbVendorId: 0x2dae }, // Hex Technology (Cube Orange / Black / Yellow)
  { usbVendorId: 0x0483 }, // STMicroelectronics (most STM32 FCs default)
  { usbVendorId: 0x1a86 }, // QinHeng CH340 (some clones / generic USB-serial)
  { usbVendorId: 0x10c4 }, // Silicon Labs CP210x (some telemetry radios)
  { usbVendorId: 0x0403 }, // FTDI (legacy telemetry — note: polyfill doesn't support FTDI yet)
];
