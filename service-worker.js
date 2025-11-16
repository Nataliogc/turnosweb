const CACHE_NAME = "turnosweb-app-v20251102_0034";
const PRECACHE = [
  "styles.css",
  "styles.mobile.css",
  "mobile.patch.js",
  "plantilla_adapter_semana.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)));
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

  // Peticiones externas: red con fallback a caché
  if (url.origin !== location.origin) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // live.mobile.html y data.js → network-first (para refrescar turnos)
  if (url.pathname.endsWith("/live.mobile.html") || url.pathname.endsWith("/data.js")) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
          return r;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Resto → cache-first con actualización en segundo plano
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
