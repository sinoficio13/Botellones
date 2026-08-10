/// <reference lib="webworker" />

const SW_VERSION = 'v1';

self.addEventListener('install', () => {
  console.log(`[SW ${SW_VERSION}] Installing…`);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[SW ${SW_VERSION}] Activated`);
  // Claim all clients so the SW controls pages immediately
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch; no caching strategy yet
  event.respondWith(fetch(event.request));
});
