"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, WifiOff, X } from "lucide-react";
import { ensureWebSerial } from "@/lib/serial-shim";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const INSTALL_DISMISSED_KEY = "air6_install_dismissed";

export function PwaBootstrap() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  // Install the Web Serial polyfill ASAP if needed (Android Chrome)
  useEffect(() => {
    ensureWebSerial();
  }, []);

  // Online / offline tracking
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Install prompt capture
  useEffect(() => {
    setInstallDismissed(localStorage.getItem(INSTALL_DISMISSED_KEY) === "1");
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Service worker registration + update detection
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let unmounted = false;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((reg) => {
      if (unmounted) return;

      // Already-waiting worker (e.g., user opened a new tab while update was pending)
      if (reg.waiting) setWaitingWorker(reg.waiting);

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
          }
        });
      });
    }).catch(() => { /* registration failed — silent */ });

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    return () => {
      unmounted = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  function applyUpdate() {
    if (!waitingWorker) return;
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
    setWaitingWorker(null);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === "accepted") setInstallEvent(null);
    else dismissInstall();
  }

  function dismissInstall() {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "1");
    setInstallDismissed(true);
    setInstallEvent(null);
  }

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center gap-2 px-4 pb-4">
      {/* Offline banner */}
      {!isOnline && (
        <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 shadow-lg backdrop-blur-sm">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>Offline — filter tool still works; catalog uses cached data</span>
        </div>
      )}

      {/* Update available */}
      {waitingWorker && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-primary/40 bg-card px-3 py-2 text-xs text-foreground shadow-lg">
          <RefreshCw className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>New version available</span>
          <button
            onClick={applyUpdate}
            className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
          >
            Reload
          </button>
        </div>
      )}

      {/* Install prompt */}
      {installEvent && !installDismissed && (
        <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground shadow-lg">
          <Download className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>Install AIR6 Params as an app</span>
          <button
            onClick={install}
            className="rounded bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer whitespace-nowrap"
          >
            Install
          </button>
          <button
            onClick={dismissInstall}
            title="Dismiss"
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
