/* ===== Compatibilidad APP MÓVIL =====
   Esta sección no afecta a index.html ni a live.html.
   Solo expone los datos al entorno móvil (live.mobile.html).
   -------------------------------------------------------- */

(function(){
  try {
    // Detectar la fuente principal de datos (DATA o FULL_DATA)
    const src =
      (typeof window.FULL_DATA !== "undefined" && window.FULL_DATA && Object.keys(window.FULL_DATA).length) ? window.FULL_DATA :
      (typeof window.DATA !== "undefined" && window.DATA && Object.keys(window.DATA).length) ? window.DATA :
      (typeof DATA !== "undefined" && DATA) ? DATA :
      null;

    // Solo si no estaba ya definida para el móvil
    if (!window.FULL_DATA && src) {
      window.FULL_DATA = src;
      console.log("[APP móvil] Datos cargados desde fuente:", src.schedule ? "schedule" : Object.keys(src));
    }

    // En algunos casos el móvil usa window.DATA directamente
    if (!window.DATA && window.FULL_DATA) {
      window.DATA = window.FULL_DATA;
    }

  } catch (err) {
    console.error("[APP móvil] No se pudo inicializar los datos:", err);
  }
})();
