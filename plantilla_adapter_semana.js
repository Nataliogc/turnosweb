/* plantilla_adapter_semana.js
   Render móvil: semanas L→D, botones ← Semana / Hoy / Semana → y aplicación de Sustituciones.
   No depende de index.html y tolera estructuras de datos desconocidas.
*/
(() => {
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const $$ = (sel, ctx=document) => Array.from(ctx.querySelectorAll(sel));

  const DIAS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

  // ---- Helpers fecha (L→D) ----
  const toDate = (d) => (d instanceof Date) ? new Date(d) : new Date(d);
  const startOfWeekMon = (d) => {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // 0 lunes, 6 domingo
    x.setDate(x.getDate() - day);
    x.setHours(0,0,0,0);
    return x;
  };
  const fmtDMY = (d) => d.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'2-digit'});
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };

  // ---- Carga base de datos (window.FULL_DATA de data.js) ----
  const DB = (typeof window.FULL_DATA === 'object' && window.FULL_DATA) ? window.FULL_DATA : {};
  const HOTELS = DB.hotels || DB.HOTELS || [];
  const SUST = DB.sustituciones || DB.SUSTITUCIONES || DB.sust || [];

  // Intentamos deducir semanas y datos sin romper si cambia la estructura
  function getWeeks() {
    // Caso habitual: DB.weeks o DB.semanas ya viene preparado
    if (Array.isArray(DB.weeks)) return DB.weeks;
    if (Array.isArray(DB.semanas)) return DB.semanas;

    // Si no, construimos una semana actual vacía para evitar romper la vista
    const today = startOfWeekMon(new Date());
    return [{
      hotel_name: "Cumbria Spa&Hotel",
      start: today.toISOString().slice(0,10),
      end: addDays(today,6).toISOString().slice(0,10),
      days: [] // se pintarán guiones si no hay datos
    }];
  }

  // Buscador flexible de turnos por hotel/fecha/empleado en estructuras variadas
  function findShiftFor(hotel, dateISO, employee) {
    // Caso 1: estructura tabular clásica
    if (DB.lookup && typeof DB.lookup === 'object') {
      const key = `${hotel}|${dateISO}|${employee}`;
      return DB.lookup[key] || "";
    }
    // Caso 2: weeks[*].rows[*].cells[day]
    if (Array.isArray(DB.weeks)) {
      for (const wk of DB.weeks) {
        if (wk.hotel && wk.hotel !== hotel) continue;
        if (!wk.start || !wk.end) continue;
        if (dateISO < wk.start || dateISO > wk.end) continue;
        if (!Array.isArray(wk.rows)) continue;
        for (const row of wk.rows) {
          if (row.employee === employee) {
            const idx = Math.floor((new Date(dateISO) - new Date(wk.start)) / 86400000);
            const c = row.cells?.[idx];
            if (c) return c;
          }
        }
      }
    }
    return "";
  }

  // Aplica sustituciones (si existen) sobre un turno concreto
  function applySubstitutions(hotel, dateISO, employee, currentLabel) {
    if (!Array.isArray(SUST) || !SUST.length) return currentLabel;
    try {
      const matches = SUST.filter(s => {
        const fecha = (s.fecha || s.date || s.Fecha || s.FECHA || "").toString().slice(0,10);
        const empTit = (s.titular || s.Titular || s.empleado || s.Empleado || "").toString().trim();
        const empSus = (s.sustituto || s.Sustituto || "").toString().trim();
        const htl    = (s.hotel || s.Hotel || s.hot || "").toString().trim();
        return fecha === dateISO && htl && hotel && htl.toLowerCase().includes(hotel.toLowerCase()) &&
               (empTit === employee || empSus === employee);
      });
      for (const s of matches) {
        const empTit = (s.titular || s.Titular || s.empleado || s.Empleado || "").toString().trim();
        const empSus = (s.sustituto || s.Sustituto || "").toString().trim();
        if (empTit === employee) {
          // Titular cede su turno → guion
          return "—";
        }
        if (empSus === employee) {
          // Sustituto asume el turno del titular → mantenemos label + ↔
          const base = currentLabel && currentLabel.trim() ? currentLabel : "Mañana";
          return base + " ↔";
        }
      }
    } catch(e) { console.warn("SUST error", e); }
    return currentLabel;
  }

  // Icono/estilo por texto del turno
  function pillFor(text) {
    const t = (text||"").toLowerCase();
    if (!t || t === "—" || t === "-") return "<span class='dash'>—</span>";
    if (t.includes("descanso")) return `<span class="pill p-descanso">Descanso</span>`;
    if (t.includes("baja")) return `<span class="pill p-baja">Baja 🩺</span>`;
    if (t.includes("noche")) return `<span class="pill p-noche">Noche 🌙</span>`;
    if (t.includes("tarde")) return `<span class="pill p-tarde">Tarde</span>`;
    if (t.includes("mañana") || t.includes("manana")) return `<span class="pill p-manana">Mañana</span>`;
    return `<span class="pill">${text}</span>`;
  }

  // ----- Estado y navegación -----
  const state = {
    baseMonday: startOfWeekMon(new Date()), // lunes actual
    weekOffset: 0, // 0 = semana actual
  };
  const $weeks = $("#weeks");
  const $meta  = $("#meta");

  function visibleMonday() {
    return addDays(state.baseMonday, state.weekOffset*7);
  }

  function render() {
    const monday = visibleMonday();
    const sunday = addDays(monday,6);
    $meta.textContent = `Semana ${fmtDMY(monday)} → ${fmtDMY(sunday)}`;

    // Render por hotel (Cumbria, Guadiana) si existen
    const hotels = HOTELS.length ? HOTELS : [{name:"Cumbria Spa&Hotel"},{name:"Sercotel Guadiana"}];
    $weeks.innerHTML = "";

    for (const h of hotels) {
      const hotelName = h.name || h.hotel || h.title || "Hotel";
      const card = document.createElement("article");
      card.className = "card";

      card.innerHTML = `
        <div class="card-header">
          <img src="${/cumbria/i.test(hotelName)?'cumbria%20logo.jpg':'guadiana%20logo.jpg'}" alt="logo">
          <div>
            <div class="card-title">${hotelName} – Semana ${monday.getWeek?.?.()||""}</div>
            <div class="meta">${fmtDMY(monday)} → ${fmtDMY(sunday)}</div>
          </div>
        </div>
        <div class="card-body">
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="name">Empleados</th>
                  ${DIAS.map((d,i)=>`<th>${d}<div class="meta">${fmtDMY(addDays(monday,i))}</div></th>`).join("")}
                </tr>
              </thead>
              <tbody id="tbody-${hotelName.replace(/\W+/g,'-')}"></tbody>
            </table>
          </div>
        </div>`;

      $weeks.appendChild(card);
      const tbody = $(`#tbody-${hotelName.replace(/\W+/g,'-')}`);

      // Empleados: intentamos deducir lista estable del dataset
      const empleados = (DB.employees || DB.empleados || h.employees || h.empleados || [])
        .map(e => (typeof e==="string"?{name:e}:e))
        .map(e => e.name || e.empleado || e.Nombre || e.NOMBRE)
        .filter(Boolean);

      // Fallback si no hay lista: agregamos empleados que aparezcan en lookup
      if (!empleados.length && DB.lookup) {
        const set = new Set();
        Object.keys(DB.lookup).forEach(k => {
          const parts = k.split("|");
          if (parts[0] && parts[0].toLowerCase().includes(hotelName.toLowerCase()) && parts[2]) set.add(parts[2]);
        });
        empleados.push(...Array.from(set));
      }

      // Render filas
      for (const emp of empleados) {
        const tr = document.createElement("tr");
        let tds = `<td class="name">${emp}</td>`;
        for (let i=0;i<7;i++){
          const dISO = addDays(monday,i).toISOString().slice(0,10);
          let label = findShiftFor(hotelName, dISO, emp);
          label = applySubstitutions(hotelName, dISO, emp, label);
          tds += `<td>${pillFor(label)}</td>`;
        }
        tr.innerHTML = tds;
        tbody.appendChild(tr);
      }
    }
  }

  // ---- Botones ----
  $("#btnPrev")?.addEventListener("click", () => { state.weekOffset -= 1; render(); });
  $("#btnNext")?.addEventListener("click", () => { state.weekOffset += 1; render(); });
  $("#btnToday")?.addEventListener("click", () => { state.weekOffset = 0; render(); });

  // Primera carga
  try { render(); }
  catch(e) {
    console.error(e);
    $("#weeks").innerHTML = `<div class="card"><div class="card-header"><div class="card-title">No se pudieron cargar los datos</div></div></div>`;
  }
})();
