/* Turnos Web · mobile.patch.js (solo vista móvil)
   - Autorrender de la semana más cercana
   - Navegación por semanas existentes
   - Turnos string/objeto, ausencias y sustituciones ↔
   - Iconos: 🌙 Noche, 🏖️ Vacaciones, 🤒 Baja, 🔄 Cambio
*/
(function () {
  "use strict";
  const $ = (s, ctx = document) => ctx.querySelector(s);
  const DAY = 86400000;

  // --- UTF-8 fixes (mojibake) ---
  function fix(s) {
    if (typeof s !== "string") return s;
    const map = [
      [/Ã¡/g, "á"], [/Ã©/g, "é"], [/Ã­/g, "í"], [/Ã³/g, "ó"], [/Ãº/g, "ú"],
      [/Ã±/g, "ñ"], [/Ã‘/g, "Ñ"], [/Ã¼/g, "ü"], [/Â¿/g, "¿"], [/Â¡/g, "¡"],
      [/Âº/g, "º"], [/Âª/g, "ª"], [/Â·/g, "·"]
    ];
    let out = s;
    for (const [re, rep] of map) out = out.replace(re, rep);
    // limpiar solo basura típica de mojibake de emojis; no borra emojis válidos
    out = out.replace(/(?:ð|Â|Ÿ)[\u0080-\u00FF\-””“„’ï¸\u00A0-\u00FF]+/g, "");
    return out.trim().replace(/\s{2,}/g, " ");
  }

  // --- fechas locales (sin UTC) ---
  const iso = d => { const x=new Date(d); x.setHours(0,0,0,0);
    return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const fromISO = s => { const [y,m,d]=s.split("-").map(n=>+n); return new Date(y,m-1,d); };
  const monday = d => { const x=new Date(d); const w=(x.getDay()+6)%7; x.setHours(0,0,0,0); x.setDate(x.getDate()-w); return x; };
  const weekDays = mon => Array.from({length:7},(_,i)=>iso(new Date(mon.getTime()+i*DAY)));
  const mini = s => { const dt = fromISO(s);
    return dt.toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"2-digit"}).toLowerCase(); };

  // --- datos ---
  const DATA = window.FULL_DATA || window.DATA || {};
  const SCHEDULE = Array.isArray(DATA.schedule) ? DATA.schedule : [];

  const WEEKS = [...new Set(SCHEDULE.map(g => g.semana_lunes))].sort();
  const byWeekHotel = new Map();
  for (const g of SCHEDULE) byWeekHotel.set(g.semana_lunes + "||" + g.hotel, g);

  const state = { weekISO: nearestWeek() };

  function nearestWeek(ref = new Date()) {
    if (!WEEKS.length) return iso(monday(ref));
    const t = monday(ref).getTime();
    return WEEKS.map(w => [w, Math.abs(fromISO(w).getTime() - t)])
                .sort((a,b)=>a[1]-b[1])[0][0];
  }

  // --- interpretación de turnos ---
  function label(turno) {
    if (turno == null) return "";
    if (typeof turno === "string") return fix(turno);
    // objeto
    return fix(turno.TipoInterpretado || turno.TipoAusencia || turno.TurnoOriginal || "");
  }

  function buildGrid(group, days) {
    const grid = {}, meta = {};
    const all = new Set(group.orden_empleados || []);
    (group.turnos || []).forEach(t => {
      if (t.turno && typeof t.turno === "object" && t.turno.Sustituto) all.add(t.turno.Sustituto);
    });
    all.forEach(e => { grid[e] = {}; meta[e] = {}; days.forEach(d => { grid[e][d] = ""; meta[e][d] = null; }); });

    (group.turnos || []).forEach(t => { grid[t.empleado] && (grid[t.empleado][t.fecha] = t.turno); });

    for (const emp of Object.keys(grid)) {
      for (const d of days) {
        const raw = grid[emp][d];
        if (raw && typeof raw === "object") {
          const labAbs = label(raw);
          grid[emp][d] = labAbs; meta[emp][d] = { isAbsence: true };
          const sust = raw.Sustituto;
          if (sust) {
            const heredado = label({ TurnoOriginal: raw.TurnoOriginal });
            if (!grid[sust]) { grid[sust] = {}; meta[sust] = {}; days.forEach(x=>{ grid[sust][x]=""; meta[sust][x]=null; }); }
            grid[sust][d] = heredado; meta[sust][d] = { isSub: true, for: emp };
          }
        } else if (typeof raw === "string") {
          grid[emp][d] = fix(raw);
        }
      }
    }

    const weekAbsent = new Set();
    (group.orden_empleados || []).forEach(emp => {
      const off = days.every(d => {
        const v = (grid[emp][d] || "").toLowerCase();
        return !v || /descanso|vacac|baja|—/.test(v);
      });
      if (off) weekAbsent.add(emp);
    });

    return { grid, meta, weekAbsent };
  }

  function render() {
    const app = $("#app"); if (!app) return;
    app.innerHTML = "";

    if (!SCHEDULE.length) {
      app.innerHTML = `<p class="meta">Sin datos.</p>`;
      return;
    }

    const days = weekDays(fromISO(state.weekISO));
    const p = document.createElement("p");
    p.className = "meta";
    p.textContent = `Semana ${mini(days[0])} → ${mini(days[6])}`;
    app.appendChild(p);

    const hotels = [...new Set(SCHEDULE.map(g => g.hotel))];

    hotels.forEach(hotel => {
      const g = byWeekHotel.get(state.weekISO + "||" + hotel);
      if (!g) return;

      const { grid, meta, weekAbsent } = buildGrid(g, days);

      let order = (g.orden_empleados || []).filter(e => !weekAbsent.has(e))
                   .concat((g.orden_empleados || []).filter(e => weekAbsent.has(e)));

      const card = document.createElement("section");
      card.className = "week";
      const logo = /cumbria/i.test(hotel) ? "cumbria%20logo.jpg"
                  : /guadiana/i.test(hotel) ? "guadiana%20logo.jpg" : "Logo.png";

      card.innerHTML = `
        <div class="week-head">
          <img src="${logo}" onerror="this.src='Logo.png'" style="width:32px;height:32px;border-radius:8px;object-fit:cover">
          <div>
            <div style="font-weight:700">${fix(hotel)} – Semana ${state.weekISO}</div>
            <div style="color:#6b7280;font-size:12px">${days[0]} → ${days[6]}</div>
          </div>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Empleados</th>
                ${days.map(d => `<th>${new Date(d+'T00:00:00').toLocaleDateString('es-ES',{weekday:'long'}).toUpperCase()}<div style="font-size:12px;color:#6b7280">${mini(d)}</div></th>`).join("")}
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>`;

      const tbody = card.querySelector("tbody");

      order.forEach(emp => {
        const tr = document.createElement("tr");
        let tds = `<td style="text-align:left">${fix(emp)}</td>`;
        days.forEach(d => {
          let lab = label(grid[emp]?.[d]);
          const low = (lab || "").toLowerCase();
          let cls = "";
          if (/vacaciones|baja|descanso/.test(low)) cls = "turno-descanso"; // rojo
          else if (/noche/.test(low)) cls = "turno-noche";                 // gris/azul
          else if (/tarde/.test(low)) cls = "turno-tarde";                 // ámbar
          else if (/mañana|manana/.test(low)) cls = "turno-mañana";        // verde

          // --- ICONOS ---
          if (/^noche$/i.test(lab) && !/🌙/.test(lab)) lab += " 🌙";
          if (/vacaciones/.test(low) && !/🏖️/.test(lab)) lab += " 🏖️";
          if (/baja/.test(low) && !/🤒/.test(lab)) lab += " 🤒";
          if (/(^| )cambio( de turno)?($| )/i.test(lab) && !/🔄/.test(lab)) lab += " 🔄";

          const m = meta[emp]?.[d];
          const swap = m && m.isSub ? " ↔" : "";

          tds += `<td>${ lab ? `<span class="turno-pill ${cls}">${lab}${swap}</span>` : "—" }</td>`;
        });
        tr.innerHTML = tds;
        tbody.appendChild(tr);
      });

      app.appendChild(card);
    });
  }

  // --- navegación por semanas existentes ---
  function move(step) {
    if (!WEEKS.length) return;
    const i = Math.max(0, WEEKS.indexOf(state.weekISO));
    const j = Math.min(WEEKS.length - 1, Math.max(0, i + step));
    state.weekISO = WEEKS[j];
    render();
  }
  $("#btnPrev")?.addEventListener("click", () => move(-1));
  $("#btnNext")?.addEventListener("click", () => move(+1));
  $("#btnToday")?.addEventListener("click", () => { state.weekISO = nearestWeek(new Date()); render(); });

  document.addEventListener("DOMContentLoaded", render);
})();
