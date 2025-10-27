const CACHE_NAME = "turnosweb-app-v7";
const APP_SHELL = [
  "/turnosweb/",
  "/turnosweb/live.html",
  "/turnosweb/live.mobile.html",
  "/turnosweb/styles.mobile.css",
  "/turnosweb/mobile.patch.js",
  "/turnosweb/manifest.json",
  "/turnosweb/icons/icon-192.png",
  "/turnosweb/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(event.request).then((resp) => {
        caches.open(CACHE_NAME).then((c) => c.put(event.request, resp.clone()));
        return resp;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(caches.match(event.request).then((c) => c || fetch(event.request)));
});
