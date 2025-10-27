Pasos más fáciles (GitHub Pages):

1) Sube estos ficheros a tu repo 'turnosweb' en la misma carpeta donde está live.html:
   - manifest.json
   - service-worker.js
   - icons/icon-192.png
   - icons/icon-512.png

2) Abre live.html y pega el contenido de SNIPPET.html en:
   - Dentro de <head>…</head>: la parte del manifest y meta.
   - Antes de </body>: el script de registro del service worker.

3) Haz commit/push. Abre en el móvil:
   https://nataliogc.github.io/turnosweb/live.html
   → Menú (Android/Chrome): “Instalar app” / “Añadir a pantalla de inicio”
   → iPhone/Safari: Compartir → “Añadir a pantalla de inicio”

Nota: La primera vez abre con conexión para que el service worker guarde la app en caché.
Para futuras actualizaciones, cambia el nombre del CACHE_NAME en service-worker.js.
