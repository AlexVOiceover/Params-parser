01 Main page, hide protected if not in use. Icon to collapse like a side panel?

02 Make it a PWA (Progressive Web App)

Goal: installable app on desktop & mobile, with offline support for the filter tool and graceful degradation for the catalog (which needs network for Supabase).

## Why PWA fits this app

- **Filter tool** is fully client-side once `apm.pdef.json` is fetched — perfect offline candidate.
- **Web Serial API** works in installed PWAs on Chromium (Chrome / Edge desktop).
- **Drone params** stored in `localStorage` — already persists without network.
- **Catalog** needs Supabase — must show "offline" state cleanly, not crash.
- **Installability** improves the workshop UX: launch from desktop icon, full-screen, no browser chrome.

## What needs to be built

### 1. Web App Manifest

`public/manifest.webmanifest`:

```json
{
  "name": "AIR6 Param Filter",
  "short_name": "AIR6 Params",
  "description": "Filter Mission Planner .param files for ArduCopter drones",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "background_color": "#0d0f14",
  "theme_color": "#0d0f14",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Linked in `app/layout.tsx`:

```tsx
export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  // ...
};
```

`viewport.themeColor` already exists — keep both light + dark variants.

### 2. Icons

Generate from a single source SVG:
- `public/icons/icon-192.png` (192×192) — Android home screen
- `public/icons/icon-512.png` (512×512) — splash screen
- `public/icons/icon-maskable-512.png` (512×512, with safe-zone padding) — Android adaptive icons
- `public/apple-touch-icon.png` (180×180) — iOS home screen
- `public/favicon.ico` — already exists

Use `pwa-asset-generator` or similar to bulk-generate from `public/icons/source.svg`.

### 3. Service worker

Next.js 15 App Router has no built-in SW. Two options:

**Option A — Serwist** (recommended; App Router compatible, Workbox successor):

```bash
npm install @serwist/next serwist
```

`next.config.ts`:

```ts
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

export default withSerwist({
  // existing config
});
```

`app/sw.ts`:

```ts
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

Register in `app/layout.tsx` via a small client component that calls `navigator.serviceWorker.register("/sw.js")` on mount.

**Option B — manual**: write `public/sw.js` by hand, register from a client component, use `caches` API. More work but zero dependencies. Skip unless dependency cost matters.

### 4. Caching strategy

Per-route policy (configured in `app/sw.ts` or via Serwist's `runtimeCaching`):

| Resource | Strategy | Notes |
|---|---|---|
| Filter page (`/`) | StaleWhileRevalidate | App shell — works offline |
| Catalog routes (`/catalog/**`) | NetworkFirst, fallback to cached | Show stale UI when offline |
| `/api/param-definitions` | StaleWhileRevalidate, 24h max-age | Already ISR-cached server-side; SW caches client-side |
| Supabase API (`*.supabase.co/**`) | NetworkOnly | Auth + dynamic data — never cache |
| Storage downloads (`*.supabase.co/storage/v1/**`) | CacheFirst with quota cap | Param files; large but immutable |
| `_next/static/**` | CacheFirst, 1 year | Hashed assets, safe to cache forever |
| Images, fonts | CacheFirst | |
| Everything else | NetworkFirst | |

**Critical**: never cache `POST` / `PUT` / `DELETE` to API routes (defaults handle this).

### 5. Offline UI

Add a small banner / toast that listens to `online`/`offline` events:

```ts
// hooks/use-online-status.ts (already partly exists?)
window.addEventListener("offline", () => setOnline(false));
window.addEventListener("online", () => setOnline(true));
```

When offline:
- Filter tool: works fully (params + lists from localStorage, defs from cache).
- Catalog: show "Offline — showing cached data, some actions disabled". Disable Upload, Delete, Clone, drone Write. Allow View / Compare with previously-cached versions.
- Login: show clear "Cannot sign in offline" message.

### 6. Install prompt

Capture `beforeinstallprompt` and store the event. Show a small "Install app" button in the header (next to the theme toggle?) when:
- Event fired (browser supports install)
- App not already in standalone mode (`window.matchMedia('(display-mode: standalone)').matches`)
- User hasn't dismissed before (track in localStorage)

```tsx
// components/install-prompt.tsx
const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
useEffect(() => {
  const handler = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent); };
  window.addEventListener("beforeinstallprompt", handler);
  return () => window.removeEventListener("beforeinstallprompt", handler);
}, []);
// Button calls deferred.prompt() then deferred.userChoice
```

### 7. Update flow

Service workers update silently. Need UX for "new version available":
- On `swRegistration.waiting` event, show toast: "New version available. Reload to update."
- On click → `waiting.postMessage({ type: 'SKIP_WAITING' })` → `window.location.reload()`.
- Without this, users stay on old cached version indefinitely.

### 8. iOS quirks

iOS Safari supports PWAs but with limitations:
- No `beforeinstallprompt` — must instruct user to "Add to Home Screen" manually.
- No Web Serial API (so drone connection only works on Chromium desktop installed).
- Must add `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` meta tags.
- Splash screens require multiple sized PNGs in specific iOS dimensions.

For this app's use case (workshop / desktop), iOS support is low priority — document as "use Chromium desktop for best experience".

### 9. Web Serial inside PWA

No code changes needed — Web Serial already works in standalone PWAs on Chromium. Key things to verify after install:
- USB permissions persist across PWA sessions (they do, per-origin)
- "Reuse previously-granted port" via `navigator.serial.getPorts()` keeps working
- HTTPS / localhost still required — PWA install respects this

### 10. Build & test checklist

- [ ] Run `npm run build` — verify `public/sw.js` is generated
- [ ] Test in Chrome DevTools → Application → Manifest (check installability)
- [ ] Test in Application → Service Workers (check registration, update flow)
- [ ] Test offline (DevTools → Network → Offline) — filter tool should still work
- [ ] Test install on Chrome desktop — launch from icon, verify standalone mode
- [ ] Test on Android Chrome — install banner, home screen icon, splash screen
- [ ] Lighthouse PWA audit — should score 90+
- [ ] Verify Web Serial still works after install
- [ ] Verify drone params persist across PWA restarts

## Order of implementation

1. Manifest + icons (10 min) — gets "Add to Home Screen" working immediately, even without SW
2. Serwist setup + basic precache (30 min) — installable + offline shell
3. Runtime caching rules (30 min) — per-resource strategy
4. Offline UI banner + disabled states (1h)
5. Install prompt button (30 min)
6. Update notification flow (30 min)
7. Lighthouse / cross-browser polish (1h)

Total: ~4 hours of focused work for a production-quality PWA.

## Risks / things to watch

- **Cache invalidation on deploy**: hashed `_next/static` assets are safe; the SW itself updates on the next page load. The manifest doesn't change often, so a stale manifest isn't a real problem.
- **Storage quota**: param files can be hundreds of KB. Cap with `expirationManager` (Workbox/Serwist) — keep last 20 downloads, max 50MB total.
- **Auth + offline**: Supabase session cookies still work offline (cookie-based), but any RPC call will fail. Make sure UI handles fetch errors gracefully (already done in most places — audit during step 4).
- **Turbopack dev mode**: SW may not register cleanly in dev. Restrict registration to production: `if (process.env.NODE_ENV === "production") navigator.serviceWorker.register(...)`.
