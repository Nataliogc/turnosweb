// service-worker.js
// CACHE_NAME es actualizado por el script de build (reemplazo de cadena).
const CACHE_NAME = "turnosweb-app-vAPP";
const APP_SHELL = [
  "./",
  "./live.mobile.html",
  "./styles.css",
  "./styles.mobile.css",
  "./plantilla_adapter_semana.js",
  "./mobile.patch.js",
  "./data.js",
  "./Logo.png",
  "./cumbria%20logo.jpg",
  "./guadiana%20logo.jpg",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME) && caches.delete(k)));
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.status === 200 && req.url.startsWith(location.origin)) {
        cache.put(req, res.clone());
      }
      return res;
    } catch {
      return cached || Response.error();
    }
  })());
});
