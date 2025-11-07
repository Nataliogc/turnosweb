/* mobile.app.js — Arranque móvil seguro (sin UI de escritorio)
   - Renderiza la semana actual del primer hotel disponible.
   - No accede a #hotelSelect / #weeks (propios del escritorio).
   - Si existen los botones de navegación (← Semana / Hoy / Semana →), los conecta.
   - Usa renderContent() (plantilla_adapter_semana.js). Fallback a MobileRenderer si existiera.
*/
(function () {
  "use strict";

  // ---------- Utilidades de fecha ----------
  const DAY = 86400000;
  const toISO = d => {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  };
  const fromISO = s => new Date(s);
  const mondayOf = any => {
    const d = any instanceof Date ? new Date(any) : new Date(any || Date.now());
    const wd = d.getDay(); // 0..6 (dom=0)
    const diff = (wd === 0 ? -6 : 1 - wd);
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };
  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  // ---------- Detección de entorno y datos ----------
  if (!window.FULL_DATA) {
    console.error("[mobile boot] Falta data.js");
    return;
  }

  // Normalizador opcional (si cargaste normalize_data.js)
  const normalizeTurno = typeof window.normalizeTurno === "function"
    ? window.normalizeTurno
    : (x => x);

  // Intenta obtener un hotel por defecto desde FULL_DATA
  function guessFirstHotel() {
    const H = Array.isArray(FULL_DATA.hoteles) ? FULL_DATA.hoteles : [];
    if (H.length) {
      const h0 = H[0] || {};
      return h0.id || h0.codigo || h0.code || h0.nombre || h0.name || "";
    }
    // Otros formatos posibles (por compatibilidad)
    const S = FULL_DATA.schedule || FULL_DATA.data || FULL_DATA.rows || [];
    if (Array.isArray(S) && S.length) {
      const first = S.find(r => r.hotel || r.Hotel || r.establecimiento || r.Establecimiento);
      if (first) {
        return (first.hotel || first.Hotel || first.establecimiento || first.Establecimiento || "").toString();
      }
    }
    return "";
  }

  // Contenedor destino: crea uno si no existe
  function ensureContainer() {
    const id = "monthly-summary-container";
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      (document.querySelector("main") || document.body).appendChild(el);
    }
    return el;
  }

  // ---------- Estado ----------
  const state = {
    hotel: guessFirstHotel(),
    start: mondayOf(new Date()) // lunes de la semana actual
  };

  // ---------- Render ----------
  function render() {
    const end = addDays(state.start, 6);
    const dateFrom = toISO(state.start);
    const dateTo = toISO(end);

    // 1) Camino principal: plantilla_adapter_semana expone renderContent
    if (typeof window.renderContent === "function") {
      // Normalización “suave” (si plantilla la soporta; si no, no pasa nada)
      try {
        window.renderContent(window.FULL_DATA, {
          hotel: state.hotel,
          employee: "",
          dateFrom,
          dateTo,
          normalize: normalizeTurno
        });
        return;
      } catch (e) {
        console.warn("[mobile boot] renderContent lanzó excepción, pruebo MobileRenderer:", e);
      }
    }

    // 2) Fallback: si existe MobileRenderer del patch móvil
    if (window.MobileRenderer && typeof window.MobileRenderer.renderWeek === "function") {
      const target = ensureContainer();
      window.MobileRenderer.renderWeek(target, {
        weekStartISO: dateFrom,
        hotel: state.hotel,
        empleado: "",
        normalize: normalizeTurno,
        hideEmptyEmployees: true
      });
      return;
    }

    console.error("[mobile boot] Falta plantilla_adapter_semana.js o MobileRenderer.");
  }

  // ---------- Navegación de semana (opcional) ----------
  function wireNavButtons() {
    // Intenta encontrar botones por texto visible (compatibles con tu diseño)
    const findByText = txt =>
      Array.from(document.querySelectorAll("button, a"))
        .find(el => (el.textContent || "").trim() === txt);

    const btnPrev = findByText("← Semana") || findByText("← Semana");
    const btnToday = findByText("Hoy");
    const btnNext = findByText("Semana →") || findByText("Semana →");

    if (btnPrev) {
      btnPrev.addEventListener("click", ev => {
        ev.preventDefault();
        state.start = addDays(state.start, -7);
        render();
      });
    }

    if (btnNext) {
      btnNext.addEventListener("click", ev => {
        ev.preventDefault();
        state.start = addDays(state.start, 7);
        render();
      });
    }

    if (btnToday) {
      btnToday.addEventListener("click", ev => {
        ev.preventDefault();
        state.start = mondayOf(new Date());
        render();
      });
    }
  }

  // ---------- Arranque ----------
  document.addEventListener("DOMContentLoaded", () => {
    // Evita arrancar si el HTML móvil aún no ha cargado los scripts de datos/plantilla
    if (!window.FULL_DATA) {
      console.error("[mobile boot] FULL_DATA no disponible en DOMContentLoaded");
      return;
    }
    wireNavButtons(); // inofensivo si los botones no existen
    render();
  });

  // Re-render suave en cambios de orientación/resize (opcional)
  let rAF;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(rAF);
    rAF = requestAnimationFrame(render);
  });
})();
