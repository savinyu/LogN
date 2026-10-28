import type { NextConfig } from "next";
import { EXTENSION_STORE_URL } from "./lib/extension";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Keep visited pages in the client router for 30 minutes, so going back to one is instant.
    // Server actions clear this cache (lib/cache.ts userDataChanged), so changes still show at
    // once, and Progress polls while a sync runs.
    staleTimes: { dynamic: 1800 },
  },
  cacheLife: {
    // Per-user reads (lib/cache.ts). Every write drops their tag, so the timers are a backstop.
    // `stale` matches staleTimes.dynamic: a shorter one would lower the route's client lifetime.
    user: { stale: 1800, revalidate: 3600, expire: 86400 },
    // Problem catalogs: synced daily, and tagged too.
    catalog: { stale: 1800, revalidate: 86400, expire: 604800 },
    // The global board reads other users' weeks; a sync drops it, this caps the rest.
    board: { stale: 1800, revalidate: 900, expire: 3600 },
    // lib/clock.ts: fresh to the minute on the server; `expire` of 5 minutes keeps it in
    // prefetches. After midnight UTC a page kept on the client may show yesterday a while longer.
    clock: { stale: 1800, revalidate: 60, expire: 300 },
  },
  // v1's dashboard is split across the v2 pages; Today is the new home (PLAN-v2.md §3).
  // /extension is the short link to the extension's store page, for posts and the README. It's
  // temporary so the target can change; /extension/connect is a page and isn't matched.
  async redirects() {
    return [
      { source: "/dashboard", destination: "/today", permanent: true },
      ...(EXTENSION_STORE_URL
        ? [{ source: "/extension", destination: EXTENSION_STORE_URL, permanent: false }]
        : []),
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
