/* Turnos Web · mobile.patch.js (solo móvil)
   - Orden por plantilla (orden_empleados) por hotel y semana
   - Sustituciones: titular ausente toda la semana -> al final; sustituto ↔ ocupa su sitio y sus turnos
   - Colores oficiales (píldoras)
*/
(function () {
  "use strict";

  // ===== Utilidades =====
  const DAY_MS = 24 * 60 * 60 * 1000;
  const fmtISO = d => new Date(d).toISOString().slice(0, 10);
  const isSameDay = (a, b) => fmtISO(a) === fmtISO(b);
  const rangodias = (monISO) => {
    const start = new Date(monISO);
    return Array.from({ length: 7 }, (_, i) => fmtISO(start.getTime() + i * DAY_MS));
  };
  const toLowerNoAcc = s => (s || "").toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim();

  // Normaliza texto de turno a tipo estándar y clase de píldora
  function normalizeTurno(txt) {
    const t = toLowerNoAcc(txt);
    if (!t || t === "—" || t === "-" || t === "_") return { label: "—", cls: "pill-empty" };
    if (t.includes("descanso")) return { label: "Descanso", cls: "pill-x" };
    if (t.includes("manana") || t.includes("mañana")) return { label: "Mañana", cls: "pill-m" };
    if (t.includes("tarde")) return { label: "Tarde", cls: "pill-t" };
    if (t.includes("noche")) return { label: "Noche 🌙", cls: "pill-n" };
    if (t.includes("vacac")) return { label: "Vacaciones", cls: "pill-x" };
    if (t.includes("baja")) return { label: "Baja", cls: "pill-x" };
    return { label: txt, cls: "pill-txt" }; // ausencias/tipos especiales con su texto tal cual
  }

  // Fuente de datos
  const SRC = (function pick() {
    const s = (window.FULL_DATA && Object.keys(window.FULL_DATA).length ? window.FULL_DATA :
               window.DATA && Object.keys(window.DATA).length ? window.DATA : null) || {};
    return s;
  })();

  const SCHEDULE = Array.isArray(SRC.schedule) ? SRC.schedule : [];
  const RAW = Array.isArray(SRC.data) ? SRC.data : []; // plano, por si hace falta
  const SUSTS = Array.isArray(SRC.sustituciones) ? SRC.sustituciones : []; // [{hotel,titular,sustituto,desde,hasta}]

  // Mapa rápido de sustituciones por hotel+semana
  function buildSustMap(hotel, weekMonISO) {
    const wk = rangodias(weekMonISO);
    const inRange = (d, desde, hasta) => {
      const x = new Date(d).getTime();
      const a = desde ? new Date(desde).getTime() : -Infinity;
      const b = hasta ? new Date(hasta).getTime() : Infinity;
      return x >= a && x <= b;
    };
    const relevant = SUSTS.filter(s => toLowerNoAcc(s.hotel) === toLowerNoAcc(hotel));
    const map = new Map(); // titular -> sustituto
    relevant.forEach(s => {
      // Si la ventana de sustitución cubre la semana, aplicamos
      const coversWeek = wk.every(d => inRange(d, s.desde, s.hasta));
      if (coversWeek) map.set(s.titular, s.sustituto);
    });
    return map;
  }

  // Render principal (no toca adapter)
  function renderContent(containerId) {
    const root = document.getElementById(containerId) || document.getElementById("app");
    if (!root) return;

    root.innerHTML = "";

    if (!SCHEDULE.length) {
      const p = document.createElement("p");
      p.className = "meta";
      p.textContent = "No hay datos para mostrar con los filtros seleccionados.";
      root.appendChild(p);
      return;
    }

    // Para cada semana por hotel, construimos tabla
    SCHEDULE.forEach(semana => {
      const { hotel, semana_lunes, orden_empleados = [], turnos = [] } = semana;
      const dias = rangodias(semana_lunes);

      // Índice de turnos por empleado+fecha
      const idx = new Map(); // key: emp|fecha -> texto turno
      turnos.forEach(t => {
        const key = `${t.empleado}__${fmtISO(t.fecha || t.date || t.dia)}`;
        idx.set(key, t.turno || t.tipo || t.texto || "");
      });

      // Detectar ausentes toda la semana (descanso/vacaciones/baja/—)
      const AUS = new Set();
      const present = new Set();
      orden_empleados.forEach(emp => {
        const allEmptyOrAbs = dias.every(d => {
          const raw = idx.get(`${emp}__${d}`) || "";
          const n = normalizeTurno(raw).label;
          return (n === "—" || n === "Descanso" || n === "Vacaciones" || n === "Baja");
        });
        if (allEmptyOrAbs) AUS.add(emp); else present.add(emp);
      });

      // Sustituciones: si existe mapeo y el titular está ausente toda la semana, sustituir en orden
      const sustMap = buildSustMap(hotel, semana_lunes);
      const ordenFinal = [];
      orden_empleados.forEach(emp => {
        if (AUS.has(emp) && sustMap.has(emp)) {
          const sub = sustMap.get(emp);
          // Inserta sustituto en la posición del titular
          ordenFinal.push({ emp: sub, mark: `↔ ${emp}` });
        } else if (AUS.has(emp)) {
          // se insertará al final
        } else {
          ordenFinal.push({ emp, mark: "" });
        }
      });
      // Ausentes toda la semana al final
      orden_empleados.forEach(emp => { if (AUS.has(emp)) ordenFinal.push({ emp, mark: "" }); });

      // Card de semana
      const card = document.createElement("section");
      card.className = "row-card week";

      // Cabecera
      const head = document.createElement("div");
      head.className = "week-head";
      head.innerHTML = `
        <img src="${/cumbria/i.test(hotel) ? 'img/cumbria logo.jpg' : /guadiana/i.test(hotel) ? 'img/guadiana logo.jpg' : 'icons/icon-192.png'}"
             alt="" style="width:40px;height:40px;border-radius:8px;object-fit:cover">
        <div class="week-meta">
          <div class="week-title" style="font-weight:700">${hotel} – Semana ${semana_lunes}</div>
          <div class="week-sub" style="color:#6b7280;font-size:12px;text-transform:lowercase">
            ${dias[0]} → ${dias[6]}
          </div>
        </div>`;
      card.appendChild(head);

      // Tabla
      const tbl = document.createElement("table");
      tbl.className = "grid-week";

      // Cabecera días
      const thead = document.createElement("thead");
      const trh = document.createElement("tr");
      trh.innerHTML = `<th style="text-align:left">Empleados</th>` + dias.map(d => `<th>${d}</th>`).join("");
      thead.appendChild(trh);
      tbl.appendChild(thead);

      // Cuerpo
      const tbody = document.createElement("tbody");
      ordenFinal.forEach(({ emp, mark }) => {
        const tr = document.createElement("tr");
        const tdName = document.createElement("td");
        tdName.className = "emp-name";
        tdName.style.textAlign = "left";
        tdName.textContent = emp + (mark ? `  ${mark}` : "");
        tr.appendChild(tdName);

        dias.forEach(d => {
          const td = document.createElement("td");
          const raw = idx.get(`${emp}__${d}`) || "";
          const n = normalizeTurno(raw);
          if (n.label === "—") {
            td.textContent = "—";
          } else {
            const span = document.createElement("span");
            span.className = `pill ${n.cls}`;
            span.textContent = n.label;
            td.appendChild(span);
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);

      card.appendChild(tbl);
      root.appendChild(card);
    });
  }

  // Hook: si el adapter no llama nada, forzamos el render móvil
  window.addEventListener("DOMContentLoaded", () => {
    try { renderContent("app"); } catch (e) { console.warn("Móvil: render diferido", e); }
  });

})();
