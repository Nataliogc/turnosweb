const CACHE_NAME = "turnosweb-pwa-v1";
const APP_SHELL = [
  "/turnosweb/",
  "/turnosweb/live.html",
  "/turnosweb/manifest.json",
  "/turnosweb/icons/icon-192.png",
  "/turnosweb/icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Network-first for external CDNs; cache-first for same-origin
  if (url.origin !== location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, copy));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  event.respondWith(caches.match(event.request).then((c) => c || fetch(event.request)));
});
