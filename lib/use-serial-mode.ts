"use client";

import { useEffect, useState } from "react";
import { ensureWebSerial, type SerialMode } from "@/lib/serial-shim";

/**
 * React hook returning the current serial transport mode.
 * Returns "unsupported" until the shim has determined what's available.
 */
export function useSerialMode(): SerialMode {
  const [mode, setMode] = useState<SerialMode>("unsupported");
  useEffect(() => {
    let cancelled = false;
    ensureWebSerial().then((m) => { if (!cancelled) setMode(m); });
    return () => { cancelled = true; };
  }, []);
  return mode;
}
