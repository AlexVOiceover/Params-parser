import withSerwistInit from "@serwist/next";

/** @type {import('next').NextConfig} */
const nextConfig = {};

// Skip the Serwist wrapper entirely in development — it injects webpack config
// that Turbopack doesn't understand (warning: "Webpack is configured while
// Turbopack is not"). Service worker is disabled in dev anyway.
const config = process.env.NODE_ENV === "development"
  ? nextConfig
  : withSerwistInit({
      swSrc: "app/sw.ts",
      swDest: "public/sw.js",
      cacheOnNavigation: true,
      reloadOnOnline: false,
    })(nextConfig);

export default config;
