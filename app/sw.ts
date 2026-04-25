/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly, CacheFirst, ExpirationPlugin } from "serwist";

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
    // Supabase REST + auth — never cache (RLS, sessions, mutations)
    {
      matcher: ({ url }) =>
        url.hostname.endsWith(".supabase.co") &&
        !url.pathname.startsWith("/storage/"),
      handler: new NetworkOnly(),
    },
    // Supabase storage (param files) — cache; immutable per storage_path
    {
      matcher: ({ url }) =>
        url.hostname.endsWith(".supabase.co") &&
        url.pathname.startsWith("/storage/"),
      handler: new CacheFirst({
        cacheName: "param-files",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 30,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            purgeOnQuotaError: true,
          }),
        ],
      }),
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

serwist.addEventListeners();
