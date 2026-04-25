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
    const native = (navigator as unknown as { serial: NativeSerial }).serial;
    return native.requestPort({ filters: ARDUPILOT_USB_FILTERS });
  }

  // Polyfill path — request via WebUSB directly with vendor-only filters
  const usb = (navigator as unknown as { usb: WebUsb }).usb;
  const filters: WebUsbDeviceFilter[] = ARDUPILOT_USB_FILTERS.map((f) => {
    const wf: WebUsbDeviceFilter = {};
    if (f.usbVendorId !== undefined) wf.vendorId = f.usbVendorId;
    if (f.usbProductId !== undefined) wf.productId = f.usbProductId;
    return wf;
  });
  const device = await usb.requestDevice({ filters });
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
