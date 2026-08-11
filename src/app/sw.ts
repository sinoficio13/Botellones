import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkFirst, Serwist } from "serwist";

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
  runtimeCaching: [
    // API / data requests: NetworkFirst with cache fallback for offline reads
    {
      matcher: ({ url }) =>
        url.hostname.endsWith(".supabase.co") ||
        url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: "api-data",
        networkTimeoutSeconds: 5,
      }),
    },
    // Static assets (CSS, JS, fonts, images): CacheFirst via defaultCache
    ...defaultCache,
  ],
});

serwist.addEventListeners();
