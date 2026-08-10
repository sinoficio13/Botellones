var SW_VERSION = "v1";

self.addEventListener("install", function () {
  console.log("[SW " + SW_VERSION + "] Installing…");
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  console.log("[SW " + SW_VERSION + "] Activated");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", function (event) {
  event.respondWith(fetch(event.request));
});
