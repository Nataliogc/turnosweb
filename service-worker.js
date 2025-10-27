const CACHE_NAME = "turnosweb-app-v12";
const APP_SHELL = [
  "/turnosweb/",
  "/turnosweb/live.html",
  "/turnosweb/live.mobile.html",
  "/turnosweb/styles.css",
  "/turnosweb/styles.mobile.css",
  "/turnosweb/mobile.patch.js",
  "/turnosweb/manifest.json",
  "/turnosweb/icons/icon-192.png",
  "/turnosweb/icons/icon-512.png"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) {
    e.respondWith(
      fetch(e.request).then(r => { caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone())); return r; })
      .catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request)));
});
