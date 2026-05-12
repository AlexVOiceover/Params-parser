/**
 * Serial transport shim — picks native Web Serial when available, otherwise
 * lazy-loads `web-serial-polyfill` which implements the same API on top of
 * WebUSB. Lets Android Chrome (which has WebUSB but not yet stable Web Serial)
 * use the same MAVLink code path as desktop.
 */

export type SerialMode = "native" | "polyfill" | "unsupported";

let installed = false;
let cachedMode: SerialMode | null = null;

function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

export async function ensureWebSerial(): Promise<SerialMode> {
  if (typeof navigator === "undefined") return "unsupported";
  if (cachedMode && (cachedMode !== "polyfill" || installed)) return cachedMode;

  // On Android, force the WebUSB polyfill path even if Chrome 148+ exposes
  // navigator.serial — native Web Serial on Android currently only supports
  // Bluetooth, so the USB device picker would be empty.
  const preferPolyfill = isAndroid();

  if ("serial" in navigator && !preferPolyfill) {
    cachedMode = "native";
    return "native";
  }
  if (!("usb" in navigator)) {
    cachedMode = "unsupported";
    return "unsupported";
  }
  try {
    await import("web-serial-polyfill");
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
  { usbVendorId: 0x26ac }, // 3DR / ProfiCNC (Pixhawk 1, Cube)
  { usbVendorId: 0x2dae }, // Hex Technology (Cube Orange / Black / Yellow)
  { usbVendorId: 0x0483 }, // STMicroelectronics (most STM32 FCs: Matek, Kakute, etc.)
  { usbVendorId: 0x3162 }, // Holybro (Pixhawk 6, Kakute H7)
  { usbVendorId: 0x27ac }, // mRobotics (mRo Control Zero, X2.1)
  { usbVendorId: 0x1fc9 }, // NXP (UCANS32K1, NXP-based FCs)
];

/**
 * Request a serial port using the active transport.
 *
 * Native Web Serial: standard `navigator.serial.requestPort` with filters.
 *
 * Polyfill: bypasses the polyfill's own `requestPort` because it forcibly
 * AND-s `classCode: 2` (CDC) at the **device** level, which fails for
 * composite USB devices (most modern flight controllers expose CDC at the
 * interface level, with device-level class 0xEF or 0x00). We call
 * `navigator.usb.requestDevice()` directly with vendor-only filters and
 * wrap the result in the polyfill's `SerialPort` class.
 */
// Use a local interface compatible with the SerialPort shape used by callers
interface OpenableSerialPort {
  open(options: { baudRate: number; bufferSize?: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
}

interface WebUsbDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
}
interface WebUsb {
  requestDevice(opts: { filters: WebUsbDeviceFilter[] }): Promise<unknown>;
  getDevices(): Promise<unknown[]>;
}
interface NativeSerial {
  requestPort(opts?: { filters?: UsbFilter[] }): Promise<OpenableSerialPort>;
  getPorts(): Promise<OpenableSerialPort[]>;
}

export async function requestDronePort(): Promise<OpenableSerialPort> {
  const mode = await ensureWebSerial();
  if (mode === "unsupported") throw new Error("Web Serial / WebUSB not supported");

  if (mode === "native") {
    // Native Web Serial: empty filters show every available serial port.
    const native = (navigator as unknown as { serial: NativeSerial }).serial;
    return native.requestPort({});
  }

  // Polyfill path — request via WebUSB directly. Empty filter object {}
  // matches all USB devices, letting the user pick whichever they want.
  // The polyfill's SerialPort constructor inspects INTERFACE-level class
  // codes (CDC control = 0x02, CDC data = 0x0A), so composite flight
  // controllers (device class 0xEF or 0x00) work correctly.
  const usb = (navigator as unknown as { usb: WebUsb }).usb;
  const device = await usb.requestDevice({ filters: [{}] });
  const polyfillModule = await import("web-serial-polyfill");
  const PolyfillSerialPort = (polyfillModule as unknown as { SerialPort: new (d: unknown) => OpenableSerialPort }).SerialPort;
  return new PolyfillSerialPort(device);
}

/** Get any previously-granted ports (so we can skip the picker on subsequent connects). */
export async function getGrantedDronePorts(): Promise<OpenableSerialPort[]> {
  const mode = await ensureWebSerial();
  if (mode === "unsupported") return [];

  if (mode === "native") {
    const native = (navigator as unknown as { serial: NativeSerial }).serial;
    return native.getPorts();
  }

  // Polyfill path — wrap each granted USB device in a polyfill SerialPort
  const usb = (navigator as unknown as { usb: WebUsb }).usb;
  const devices = await usb.getDevices();
  if (devices.length === 0) return [];
  const polyfillModule = await import("web-serial-polyfill");
  const PolyfillSerialPort = (polyfillModule as unknown as { SerialPort: new (d: unknown) => OpenableSerialPort }).SerialPort;
  return devices.map((d) => new PolyfillSerialPort(d));
}
