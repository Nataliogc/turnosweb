/* plantilla_mobile_adapter.js
   Adaptador móvil para Turnos Web — No toca index/live
   - Genera FULL_DATA.hoteles si no existe (a partir de FULL_DATA o del array de semanas)
   - Expone:
       window.populateFilters()  // rellena select de hoteles (si existe)
       window.renderContent(data, { hotel, dateFrom, dateTo }) // pinta la semana
*/

(function () {
  "use strict";

  // ---------- Utils de fechas ----------
  const DAY = 86400000;
  const toISO = (d) => {
    if (!d) return "";
    if (typeof d === "string") return d.slice(0, 10);
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  };
  const fromISO = (s) => new Date(s);
  const addDays = (iso, n) => toISO(new Date(fromISO(iso).getTime() + n * DAY));
  const mondayOf = (any) => {
    const d = typeof any === "string" ? new Date(any) : new Date(any);
    const wd = (d.getDay() + 6) % 7; // 0->6 (dom), 1->0 (lun)
    return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - wd));
  };

  // ---------- Normalizador de texto (ligero; el grueso puede estar en mobile.patch.js) ----------
  function normalizeCell(txt) {
    if (!txt) return "";
    let out = String(txt);
    // Mojibake más comunes
    out = out
      .replace(/MaÃ±ana/g, "Mañana")
      .replace(/Tarde/g, "Tarde")
      .replace(/Noche\s*(?:ð[\u0000-\uFFFF]*|🌙)?/g, "Noche 🌙")
      .replace(/Descanso(?:[^\w]|”|„)*/g, "Descanso")
      .replace(/Vacaciones(?:[^\w]|¤|–|ï¸|–)*/g, "Vacaciones 🏖️")
      .replace(/Baja(?:[^\w]|¤|’|ï¸)*/g, "Baja 🤒")
      .replace(/Permiso(?:[^\w]|ðŸ—“ï¸)*/g, "Permiso 🗓️")
      .replace(/Formaci[oó]n(?:[^\w]|ðŸ“)?/g, "Formación 🎓")
      .replace(/\bC\/T\b|Cambio(?:\s+de)?\s+turno|\u2194/g, "C/T 🔄")
      .replace(/[\uFFFD\u0092\u00AD]/g, "");
    if (/^Noche\s*$/.test(out)) out = "Noche 🌙";
    return out.trim();
  }

  // ---------- Modelo flexible a partir de data.js ----------
  function buildModel() {
    // FULL_DATA puede ser:
    //  A) Array de semanas
    //  B) Objeto { semanas:[…] } (con o sin hoteles)
    //  C) Algún alias tipo window.DATA / window.SCHEDULE
    let FD = window.FULL_DATA;
    if (!FD) {
      FD = window.DATA || window.SCHEDULE || {};
      window.FULL_DATA = FD;
    }

    // Si es array → envolver como {semanas:[…]}
    if (Array.isArray(FD)) {
      FD = { semanas: FD };
      window.FULL_DATA = FD;
    }

    // Asegurar FULL_DATA.semanas
    if (!Array.isArray(FD.semanas)) {
      // Prueba a rescatar arrays conocidos:
      const guess =
        FD.rows || FD.data || FD.turnos || FD.semana || FD.semana_rows || [];
      FD.semanas = Array.isArray(guess) ? guess : [];
    }

    // Construir hoteles si no están
    if (!Array.isArray(FD.hoteles)) {
      const set = new Set();
      for (const s of FD.semanas) {
        if (s && s.hotel) set.add(String(s.hotel).trim());
      }
      FD.hoteles = [...set].map((h) => ({ id: h, nombre: h }));
    }

    return FD; // {hoteles:[{id,nombre}], semanas:[…]}
  }

  // ---------- Buscar semanas / filas para pintar ----------
  function pickRowsForWeek(FD, hotel, weekStartISO) {
    const rows = [];

    // Caso 1: semanas “agrupadas” (cada item es una semana con lista interna)
    // Campos orientativos: { hotel, semana_lunes, orden_empleados, turnos:[{empleado,fecha,turno}] }
    const grouped = FD.semanas.filter(
      (s) =>
        s &&
        String(s.hotel).trim() === String(hotel).trim() &&
        toISO(s.semana_lunes || s.weekStart || s.lunes || s.mon) ===
          weekStartISO
    );

    if (grouped.length) {
      for (const s of grouped) {
        const block =
          s.turnos || s.rows || s.data || s.empleados || s.personas || [];
        // Intentar forma {empleado, fecha, turno} / {persona, dia, tramo}
        for (const r of block) {
          const empleado =
            r.empleado || r.persona || r.nombre || r.name || r.worker || "";
          const fecha = toISO(
            r.fecha || r.dia || r.date || r.f || r.day || r.Fecha || ""
          );
          const turno =
            r.turno ||
            r.Tramo ||
            r.TipoAusencia ||
            r.TipoInterpretado ||
            r.shift ||
            r.tramo ||
            "";

          if (empleado && fecha) {
            rows.push({ hotel, empleado: String(empleado), fecha, turno });
          }
        }
      }
      return rows;
    }

    // Caso 2: plano (todas las filas en un mismo array FD.semanas)
    // Soportar {hotel, empleado, fecha, turno}
    for (const r of FD.semanas) {
      const h = r.hotel || r.Hotel || r.establecimiento || "";
      if (String(h).trim() !== String(hotel).trim()) continue;
      const fecha = toISO(r.fecha || r.Fecha || r.day || r.date || "");
      if (!fecha) continue;
      // ¿Cae dentro de esa semana?
      if (mondayOf(fecha) !== weekStartISO) continue;

      const empleado =
        r.empleado || r.persona || r.nombre || r.name || r.worker || "";
      const turno =
        r.turno ||
        r.Tramo ||
        r.TipoAusencia ||
        r.TipoInterpretado ||
        r.shift ||
        r.tramo ||
        "";

      if (empleado) rows.push({ hotel: h, empleado: String(empleado), fecha, turno });
    }

    return rows;
  }

  // ---------- Píldoras ----------
  function pill(label) {
    const txt = normalizeCell(label || "");
    const l = txt.toLowerCase();
    let cls = "pill";
    if (l.startsWith("mañana")) cls += " pill-am";
    else if (l.startsWith("tarde")) cls += " pill-pm";
    else if (l.startsWith("noche")) cls += " pill-night";
    else if (l.startsWith("descanso")) cls += " pill-off";
    else if (l.startsWith("vacaciones")) cls += " pill-vac";
    else if (l.startsWith("baja")) cls += " pill-low";
    else if (l.startsWith("permiso")) cls += " pill-perm";
    else if (l.startsWith("formación")) cls += " pill-form";
    else if (l.startsWith("c/t")) cls += " pill-ct";
    return `<span class="${cls}">${txt || "—"}</span>`;
  }

  // ---------- CSS mínimo (por si falta en móvil) ----------
  const STYLE = `
  .weekCard{background:#fff;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,.06);padding:14px 14px;margin:14px 0}
  .weekHead{display:flex;align-items:center;gap:12px;margin-bottom:10px}
  .weekLogo{width:40px;height:40px;object-fit:contain;border-radius:8px}
  .weekTitle{font:700 1rem system-ui;color:#122}
  .weekRange{font:600 .86rem system-ui;color:#456}
  .grid{width:100%;border-collapse:collapse}
  .grid th,.grid td{border-bottom:1px solid #eef3f7;padding:10px 8px;vertical-align:middle}
  .grid th{font:700 .85rem system-ui;color:#2a3a46;background:#f8fafc}
  .emp{white-space:nowrap;font:600 .95rem system-ui;color:#112}
  .muted{color:#9fb0c0}
  .pill{display:inline-block;padding:.25rem .6rem;border-radius:999px;font:700 .8rem system-ui}
  .pill-am{background:#e7f7ea;color:#136b2c}
  .pill-pm{background:#fff3d6;color:#7e5b00}
  .pill-night{background:#eae6ff;color:#3e2b84}
  .pill-off{background:#ffe0e0;color:#8b1b1b}
  .pill-vac{background:#dff5ff;color:#035f88}
  .pill-low{background:#fde4ff;color:#7b2d86}
  .pill-perm{background:#e9f0ff;color:#274d9c}
  .pill-form{background:#efe7ff;color:#5b2d91}
  .pill-ct{background:#e6fff2;color:#0f6a45}
  `;
  function ensureStyle() {
    if (document.getElementById("mobile-inline-style")) return;
    const s = document.createElement("style");
    s.id = "mobile-inline-style";
    s.textContent = STYLE;
    document.head.appendChild(s);
  }

  // ---------- API: populateFilters ----------
  window.populateFilters = function populateFilters() {
    const FD = buildModel();
    // Si el panel aún no existe, salir silenciosamente (evita errores)
    const hotelSelect = document.getElementById("hotelSelect");
    if (!hotelSelect || !Array.isArray(FD.hoteles)) return;

    // Rellenar hoteles
    hotelSelect.innerHTML = FD.hoteles
      .map((h) => `<option value="${h.id}">${h.nombre || h.id}</option>`)
      .join("");

    // No tocamos fechas aquí — mobile.app se encarga de los pickers.
  };

  // ---------- API: renderContent ----------
  window.renderContent = function renderContent(_FD, opts) {
    ensureStyle();

    const FD = buildModel();
    const hotel = (opts && (opts.hotel || opts.Hotel)) || (FD.hoteles[0] && FD.hoteles[0].id) || "";
    if (!hotel) {
      const main = document.querySelector("main") || document.body;
      main.innerHTML =
        `<div class="weekCard"><div class="muted">No se han detectado hoteles en los datos.</div></div>`;
      return;
    }

    // Semana destino
    const weekStartISO = mondayOf((opts && (opts.dateFrom || opts.from)) || new Date());
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartISO, i));

    // Filas de la semana para ese hotel
    const rows = pickRowsForWeek(FD, hotel, weekStartISO);

    // Agrupar por empleado
    const byEmp = new Map();
    for (const r of rows) {
      const emp = String(r.empleado || r.persona || r.nombre || "").trim();
      if (!emp) continue;
      if (!byEmp.has(emp)) byEmp.set(emp, {});
      const raw = r.turno && typeof r.turno === "object"
        ? (r.turno.TipoInterpretado || r.turno.TurnoOriginal || r.turno.tramo || "")
        : r.turno || "";
      byEmp.get(emp)[toISO(r.fecha)] = normalizeCell(raw);
    }

    // Orden sugerido si existe
    const order = [];
    const wk = FD.semanas.find(
      (s) =>
        s &&
        String(s.hotel).trim() === String(hotel).trim() &&
        toISO(s.semana_lunes || s.weekStart || s.lunes || s.mon) === weekStartISO
    );
    if (wk && Array.isArray(wk.orden_empleados)) {
      for (const e of wk.orden_empleados) order.push(String(e).trim());
    }

    // Componer filas HTML
    const uniq = new Set([...order, ...byEmp.keys()]);
    const rowsHtml = [];
    for (const emp of uniq) {
      const map = byEmp.get(emp) || {};
      const tds = days
        .map((d) => {
          const v = map[d] || "";
          return `<td>${v ? pill(v) : '<span class="muted">—</span>'}</td>`;
        })
        .join("");
      rowsHtml.push(`<tr><td class="emp">${emp}</td>${tds}</tr>`);
    }

    // Header hotel + semana
    const logo =
      String(hotel).toLowerCase().includes("cumbria")
        ? "img/cumbria.jpg"
        : String(hotel).toLowerCase().includes("guadiana")
        ? "img/guadiana.jpg"
        : "";
    const range = `${weekStartISO} → ${addDays(weekStartISO, 6)}`;

    const tableHtml = `
      <div class="weekCard">
        <div class="weekHead">
          ${logo ? `<img class="weekLogo" src="${logo}" alt="">` : ""}
          <div>
            <div class="weekTitle">${hotel}</div>
            <div class="weekRange">${range}</div>
          </div>
        </div>
        <table class="grid">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Lun<br>${days[0].split("-").reverse().join("/")}</th>
              <th>Mar<br>${days[1].split("-").reverse().join("/")}</th>
              <th>Mié<br>${days[2].split("-").reverse().join("/")}</th>
              <th>Jue<br>${days[3].split("-").reverse().join("/")}</th>
              <th>Vie<br>${days[4].split("-").reverse().join("/")}</th>
              <th>Sáb<br>${days[5].split("-").reverse().join("/")}</th>
              <th>Dom<br>${days[6].split("-").reverse().join("/")}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.join("") || '<tr><td colspan="8" class="muted">No hay datos para esa semana.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;

    // Volcado en pantalla
    let target =
      document.getElementById("monthly-summary-container") ||
      document.querySelector("main") ||
      document.body;
    // Si tu app móvil muestra 2 hoteles a la vez, descomenta el siguiente bloque
    // para pintar Cumbria y Guadiana seguidos. Por defecto, se pinta el hotel filtrado.
    //
    // const other = (FD.hoteles || []).map(h => h.id).filter(h => h !== hotel);
    // …(repetir render para cada uno)…

    target.innerHTML = tableHtml;
    document.dispatchEvent(new CustomEvent("mobile:rendered"));
  };
})();
