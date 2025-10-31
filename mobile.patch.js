/* Turnos Web · mobile.patch.js
   - Solo móvil (live.mobile.html). No toca plantilla_adapter_semana.js
   - Lee window.FULL_DATA.schedule generado por 2_GenerarCuadranteHTML.py
   - Semanas L→D (España), navegación por semanas existentes, sustituciones ↔
   - Píldoras: Descanso (rojo), Noche🌙 (gris), Tarde (ámbar), Mañana (verde)
*/

(function () {
  "use strict";

  // ---------- Utils ----------
  const $ = (s, ctx = document) => ctx.querySelector(s);
  const DAY = 86400000;

  // Mojibake → UTF-8
  function fixMojibake(s) {
    if (typeof s !== "string") return s;
    const map = [
      [/Ã¡/g, "á"], [/Ã©/g, "é"], [/Ã­/g, "í"], [/Ã³/g, "ó"], [/Ãº/g, "ú"],
      [/Ã±/g, "ñ"], [/Ã‘/g, "Ñ"], [/Ã¼/g, "ü"], [/Â¿/g, "¿"], [/Â¡/g, "¡"],
      [/Âº/g, "º"], [/Âª/g, "ª"], [/Â·/g, "·"]
    ];
    let out = s;
    for (const [re, rep] of map) out = out.replace(re, rep);
    // limpiar basura de emojis cortados
    out = out.replace(/[ðÂŸ][\u0080-\u00FF\-””“„’ï¸\u00A0-\u00FF]*/g, "");
    return out.trim().replace(/\s{2,}/g, " ");
  }

  // Fechas locales (no UTC)
  const isoLocal = d => { const x = new Date(d); x.setHours(0,0,0,0);
    const y=x.getFullYear(), m=String(x.getMonth()+1).padStart(2,'0'), dd=String(x.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; };
  const fromISO = iso => { const [y,m,d] = iso.split("-").map(n=>parseInt(n,10)); return new Date(y, m-1, d); };
  const monday = d => { const x=new Date(d); const w=(x.getDay()+6)%7; x.setHours(0,0,0,0); x.setDate(x.getDate()-w); return x; };
  const weekRange = mon => Array.from({length:7},(_,i)=>isoLocal(new Date(mon.getTime()+i*DAY)));
  const mini = iso => { const dt=fromISO(iso); const dd=String(dt.getDate()).padStart(2,"0");
    const m=new Intl.DateTimeFormat("es-ES",{month:"short"}).format(dt).replace(".",""); const yy=String(dt.getFullYear()).slice(-2);
    return `${dd}/${m}/${yy}`.toLowerCase(); };

  // ---------- Datos ----------
  const DATA = window.FULL_DATA || window.DATA || {};
  const SCHEDULE = Array.isArray(DATA.schedule) ? DATA.schedule : [];

  // Semanas disponibles (ordenadas) y por hotel
  const WEEKS = [...new Set(SCHEDULE.map(g => g.semana_lunes))].sort();
  const byWeekHotel = new Map();
  for (const g of SCHEDULE) byWeekHotel.set(g.semana_lunes + "||" + g.hotel, g);

  // Encontrar semana cercana a hoy
  function nearestWeekISO(ref = new Date()) {
    if (!WEEKS.length) return isoLocal(monday(ref));
    const target = monday(ref).getTime();
    return WEEKS.map(w => [w, Math.abs(fromISO(w).getTime() - target)])
                .sort((a,b)=>a[1]-b[1])[0][0];
  }

  // Estado
  const state = { weekISO: nearestWeekISO(new Date()) };

  // ---------- Interpretación de turnos ----------
  function labelFromTurno(turno) {
    if (turno == null) return "";
    if (typeof turno === "string") return fixMojibake(turno);
    // objeto: { TurnoOriginal, TipoInterpretado, TipoAusencia, Sustituto }
    const tInt = fixMojibake(turno.TipoInterpretado || turno.TipoAusencia || "");
    const tOrg = fixMojibake(turno.TurnoOriginal || "");
    return tInt || tOrg || "";
  }

  // Construye parrilla aplicando sustituciones y marcadores
  function buildGrid(group, days) {
    const grid = {}, meta = {};
    const all = new Set(group.orden_empleados);
    // sumar posibles sustitutos para que tengan fila
    (group.turnos || []).forEach(t => {
      if (typeof t.turno === "object" && t.turno && t.turno.Sustituto) all.add(t.turno.Sustituto);
    });
    all.forEach(emp => { grid[emp] = {}; meta[emp] = {}; days.forEach(d => { grid[emp][d]=""; meta[emp][d]=null; }); });

    // 1) volcar lo que viene
    (group.turnos || []).forEach(t => { grid[t.empleado][t.fecha] = t.turno; });

    // 2) aplicar ausencias y sustituciones
    for (const emp of Object.keys(grid)) {
      for (const d of days) {
        const raw = grid[emp][d];
        if (typeof raw === "object" && raw !== null) {
          const etiqueta = labelFromTurno(raw);
          grid[emp][d] = etiqueta;                   // el titular muestra la ausencia
          meta[emp][d] = { isAbsence: true, absence: etiqueta };
          const sust = raw.Sustituto;
          if (sust) {                                // el sustituto hereda el turno original del titular
            const labS = labelFromTurno({ TurnoOriginal: raw.TurnoOriginal });
            grid[sust][d] = labS;
            meta[sust][d] = { isSub: true, for: emp };
          }
        } else if (typeof raw === "string") {
          grid[emp][d] = fixMojibake(raw);
        }
      }
    }

    // 3) detectar ausentes toda la semana y proponer sustituto
    const weekAbsent = new Set();
    const subCandidate = {};
    group.orden_empleados.forEach(emp => {
      const allOff = days.every(d => {
        const v = (grid[emp][d] || "").toLowerCase();
        return !v || /descanso|vacac|baja|—/.test(v);
      });
      if (allOff) {
        weekAbsent.add(emp);
        // primer sustituto que encontremos
        for (const d of days) {
          const m = meta[emp][d];
          if (m && m.isAbsence) {
            // ¿quién lo sustituyó?
            for (const e of Object.keys(grid)) {
              const m2 = meta[e][d];
              if (m2 && m2.isSub && m2.for === emp) { subCandidate[emp] = e; break; }
            }
            if (subCandidate[emp]) break;
          }
        }
      }
    });

    return { grid, meta, weekAbsent, subCandidate };
  }

  // ---------- Render ----------
  function render() {
    const metaEl = $("#meta");
    const root = $("#weeks");
    root.innerHTML = "";

    if (!SCHEDULE.length) {
      metaEl.textContent = "Sin datos.";
      return;
    }

    const days = weekRange(fromISO(state.weekISO));
    metaEl.textContent = `Semana ${mini(days[0])} → ${mini(days[6])}`;

    const hotels = [...new Set(SCHEDULE.map(g => g.hotel))];
    for (const h of hotels) {
      const g = byWeekHotel.get(state.weekISO + "||" + h);
      if (!g) continue;

      const { grid, meta, weekAbsent, subCandidate } = buildGrid(g, days);

      // orden visual: titulares presentes primero; ausentes toda la semana al final; si hay sustituto, ocupa su sitio
      let order = g.orden_empleados.map(e => weekAbsent.has(e) ? (subCandidate[e] || e) : e);
      order = [...new Set(order)]; // sin duplicados
      order = order.filter(e => !weekAbsent.has(e)).concat([...weekAbsent]);

      const card = document.createElement("article");
      card.className = "card";
      const logo = /cumbria/i.test(h) ? "cumbria%20logo.jpg" : /guadiana/i.test(h) ? "guadiana%20logo.jpg" : "Logo.png";

      // cabecera
      card.innerHTML = `
        <div class="head">
          <img src="${logo}" onerror="this.src='Logo.png'">
          <div>
            <div class="title"><strong>${fixMojibake(h)}</strong> – Semana ${state.weekISO}</div>
            <div class="sub">${days[0]} → ${days[6]}</div>
          </div>
        </div>
        <div class="body">
          <table>
            <thead>
              <tr>
                <th>Empleados</th>
                ${days.map(d => `<th>${new Date(d+'T00:00:00').toLocaleDateString('es-ES',{weekday:'long'}).toUpperCase()}
                  <div class="sub">${mini(d)}</div></th>`).join("")}
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>`;

      const tbody = card.querySelector("tbody");

      order.forEach(emp => {
        const tr = document.createElement("tr");
        let tds = `<td class="emp">${fixMojibake(emp)}</td>`;
        days.forEach(d => {
          let label = grid[emp][d] || "";
          label = fixMojibake(label);
          const low = label.toLowerCase();

          // clase de estilo por tipo
          let cls = "";
          if (/vacaciones|baja|descanso/.test(low)) cls = "p-x";
          else if (/noche/.test(low)) cls = "p-n";
          else if (/tarde/.test(low)) cls = "p-t";
          else if (/mañana|manana/.test(low)) cls = "p-m";

          // añadir 🌙 a "Noche" si falta
          if (/^n(oche)?/i.test(label) && !/🌙/.test(label)) label += " 🌙";

          const m = meta[emp][d];
          const swap = m && m.isSub ? " ↔" : "";
          tds += `<td>${ label ? `<span class="pill ${cls}">${label}${swap}</span>` : '<span class="dash">—</span>' }</td>`;
        });
        tr.innerHTML = tds;
        tbody.appendChild(tr);
      });

      root.appendChild(card);
    }
  }

  // ---------- Navegación (usa las semanas que EXISTEN) ----------
  function moveWeek(step) {
    if (!WEEKS.length) return;
    const i = Math.max(0, WEEKS.indexOf(state.weekISO));
    const j = Math.min(WEEKS.length - 1, Math.max(0, i + step));
    state.weekISO = WEEKS[j];
    render();
  }
  $("#mPrev")?.addEventListener("click", () => moveWeek(-1));
  $("#mNext")?.addEventListener("click", () => moveWeek(+1));
  $("#mToday")?.addEventListener("click", () => { state.weekISO = nearestWeekISO(new Date()); render(); });

  // ---------- Start ----------
  document.addEventListener("DOMContentLoaded", render);
})();
