/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Don't auto-skipWaiting — let user trigger via "Reload to update"
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Supabase (REST, auth, storage) and param files — never cache: RLS and sessions decide access
    {
      matcher: ({ url }) =>
        url.hostname.endsWith(".supabase.co") || url.pathname.startsWith("/api/versions/"),
      handler: new NetworkOnly(),
    },
    // ArduPilot pdef.json (proxied via /api/param-definitions) — long stale-while-revalidate
    ...defaultCache,
  ],
  // Allow client to ask the waiting worker to activate immediately
  fallbacks: {
    entries: [
      {
        url: "/",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Param files used to be cached here; drop that cache so nothing outlives a revoked login.
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(caches.delete("param-files"));
});

serwist.addEventListeners();
