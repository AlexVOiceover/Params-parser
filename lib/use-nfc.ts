"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type NFCStatus = "idle" | "waiting" | "success" | "error";
export type NFCErrorType = "permission_denied" | "write_failed" | "not_supported" | null;

interface NFCResult {
  isSupported: boolean;
  status: NFCStatus;
  errorType: NFCErrorType;
  write: (serial: string) => Promise<void>;
  reset: () => void;
}

function detectSupport(): boolean {
  return typeof window !== "undefined" && typeof (window as { NDEFReader?: unknown }).NDEFReader !== "undefined";
}

export function useNFC(): NFCResult {
  const [isSupported] = useState<boolean>(() => detectSupport());
  const [status, setStatus] = useState<NFCStatus>("idle");
  const [errorType, setErrorType] = useState<NFCErrorType>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    setStatus("idle");
    setErrorType(null);
  }, []);

  const write = useCallback(async (serial: string) => {
    if (!isSupported) {
      setStatus("error");
      setErrorType("not_supported");
      return;
    }

    setStatus("waiting");
    setErrorType(null);

    try {
      const reader = new NDEFReader();
      const appUrl = `${window.location.origin}/drone/${encodeURIComponent(serial)}`;
      await reader.write({
        records: [
          { recordType: "url", data: appUrl },
          { recordType: "text", data: serial, lang: "en" },
        ],
      });
      setStatus("success");
      resetTimerRef.current = setTimeout(() => {
        setStatus("idle");
        setErrorType(null);
      }, 3000);
    } catch (err) {
      setStatus("error");
      if (err instanceof Error && err.name === "NotAllowedError") {
        setErrorType("permission_denied");
      } else {
        setErrorType("write_failed");
      }
    }
  }, [isSupported]);

  return { isSupported, status, errorType, write, reset };
}
