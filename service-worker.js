// SW con reglas claras: HTML y data.js => NETWORK-FIRST
const CACHE_NAME = "turnosweb-app-v20251028_1";

const PRECACHE = [
  "styles.css",
  "styles.mobile.css",
  "mobile.patch.js",
  "plantilla_adapter_semana.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

// No precachear live.mobile.html ni data.js para que cojan SIEMPRE lo nuevo
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

  // Externos → network-first con fallback
  if (url.origin !== location.origin) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // APP HTML y datos → network-first (para ver formato y turnos nuevos SIEMPRE)
  if (url.pathname.endsWith("/live.mobile.html") || url.pathname.endsWith("/data.js") ) {
    e.respondWith(
      fetch(e.request)
        .then(r => { const copy = r.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, copy)); return r; })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Resto (CSS/JS internos) → stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(r => {
        const copy = r.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, copy)); return r;
      }).catch(()=>cached);
      return cached || fetchPromise;
    })
  );
});
