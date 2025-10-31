/* Turnos Web · mobile.patch.js (solo vista móvil)
   - Autorrender semana más cercana
   - Navegación (← / Hoy / →) por semanas existentes
   - Turnos string/objeto, ausencias y sustituciones ↔
   - Iconos: 🌙 Noche, 🏖️ Vacaciones, 🤒 Baja, 🗓️ Permiso, 🎓 Formación, 🔄 Cambio/C·T/C/T/→/↔
   - OCULTAR solo filas 100% vacías (“—” toda la semana)
   - Regla: ausentes toda la semana se muestran al final; si hay Sustituto, éste ocupa su posición
*/
(function () {
  "use strict";
  const $ = (s, ctx = document) => ctx.querySelector(s);
  const DAY = 86400000;

  // --- Mojibake → UTF-8 limpio (incluye basura de emojis, controles y signos sueltos) ---
  function fix(s) {
    if (typeof s !== "string") return s;
    const map = [
      [/Ã¡/g, "á"], [/Ã©/g, "é"], [/Ã­/g, "í"], [/Ã³/g, "ó"], [/Ãº/g, "ú"],
      [/Ã±/g, "ñ"], [/Ã‘/g, "Ñ"], [/Ã¼/g, "ü"], [/Â¿/g, "¿"], [/Â¡/g, "¡"],
      [/Âº/g, "º"], [/Âª/g, "ª"], [/Â·/g, "·"]
    ];
    let out = s;
    for (const [re, rep] of map) out = out.replace(re, rep);

    // 1) Controles invisibles (incluye \u009F "")
    out = out.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

    // 2) Secuencias típicas de mojibake de emoji (no borra emojis válidos)
    out = out
      .replace(/ð[\u0080-\u00FF\-–—”“"'\u00A0-\u00FF]*/g, "")
      .replace(/Â[\u0080-\u00FF\-–—”“"'\u00A0-\u00FF]*/g, "")
      .replace(/ï¸[\u0080-\u00FF\-–—”“"'\u00A0-\u00FF]*/g, "")
      .replace(/\uFFFD/g, "")
      .replace(/[Ÿ ]/g, "");

    // 3) Símbolos sueltos de mojibake vistos (p. ej. "¤’")
    out = out.replace(/[¤’‚‹›˘]/g, "");

    return out.trim().replace(/\s{2,}/g, " ");
  }

  // --- Fechas ---
  const iso = d => { const x=new Date(d); x.setHours(0,0,0,0);
    return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const fromISO = s => { const [y,m,d]=s.split("-").map(n=>+n); return new Date(y,m-1,d); };
  const monday = d => { const x=new Date(d); const w=(x.getDay()+6)%7; x.setHours(0,0,0,0); x.setDate(x.getDate()-w); return x; };
  const weekDays = mon => Array.from({length:7},(_,i)=>iso(new Date(mon.getTime()+i*DAY)));
  const mini = s => { const dt = fromISO(s);
    return dt.toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"2-digit"}).toLowerCase(); };

  // --- Datos ---
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

  // --- Interpretación + emojis canónicos ---
  function rawLabel(turno) {
    if (turno == null) return "";
    if (typeof turno === "string") return fix(turno);
    return fix(turno.TipoInterpretado || turno.TipoAusencia || turno.TurnoOriginal || "");
  }

  function withCanonicalEmoji(label) {
    let out = (label || "").trim();
    const low = out.toLowerCase();

    const changeMarkRE = /(↔|→|←|”„|->|=>)/;

    if (/vacaciones/.test(low) && !/🏖️/.test(out)) out += " 🏖️";
    if (/baja/.test(low)       && !/🤒/.test(out)) out += " 🤒";
    if (/permiso/.test(low)    && !/🗓️/.test(out)) out += " 🗓️";
    if (/formaci[oó]n/.test(low) && !/🎓/.test(out)) out += " 🎓";
    if (/(^| )c\/?t( |$)|\bct\b|cambio( de turno)?/i.test(out) || changeMarkRE.test(out)) {
      if (!/🔄/.test(out)) out += " 🔄";
    }
    if (/^noche$/i.test(out) && !/🌙/.test(out)) out += " 🌙";

    // Limpiar flechas/comillas raras que no queremos mostrar
    out = out.replace(/[↔→←”“„]/g, "").trim().replace(/\s{2,}/g, " ");

    return out;
  }

  // --- Construir grid + mapa de sustitutos predominantes ---
  function buildGrid(group, days) {
    const grid = {}, meta = {};
    const subCount = {}; // { empleadoAusente: {Sub: veces} }

    const all = new Set(group.orden_empleados || []);
    (group.turnos || []).forEach(t => {
      if (t.turno && typeof t.turno === "object" && t.turno.Sustituto) all.add(t.turno.Sustituto);
    });
    all.forEach(e => { grid[e] = {}; meta[e] = {}; days.forEach(d => { grid[e][d] = ""; meta[e][d] = null; }); });

    (group.turnos || []).forEach(t => { if (grid[t.empleado]) grid[t.empleado][t.fecha] = t.turno; });

    for (const emp of Object.keys(grid)) {
      for (const d of days) {
        const raw = grid[emp][d];
        if (raw && typeof raw === "object") {
          const labAbs = rawLabel(raw);
          grid[emp][d] = labAbs; meta[emp][d] = { isAbsence: true, sub: raw.Sustituto || null };
          const sust = raw.Sustituto;
          if (sust) {
            // contar sustituto predominante del ausente
            subCount[emp] = subCount[emp] || {};
            subCount[emp][sust] = (subCount[emp][sust] || 0) + 1;

            const heredado = rawLabel({ TurnoOriginal: raw.TurnoOriginal });
            if (!grid[sust]) { grid[sust] = {}; meta[sust] = {}; days.forEach(x=>{ grid[sust][x]=""; meta[sust][x]=null; }); }
            grid[sust][d] = heredado; meta[sust][d] = { isSub: true, for: emp };
          }
        } else if (typeof raw === "string") {
          grid[emp][d] = fix(raw);
        }
      }
    }

    // Clasificaciones por semana
    const weekEmpty = new Set();      // todo "—"
    const weekAbsent = new Set();     // ausencias (vac/baja/perm/form/descanso) toda la semana
    const weekAbsenceType = {};       // "vacaciones"/"baja"/"permiso"/"formacion"/"descanso"
    (group.orden_empleados || []).forEach(emp => {
      let hasSomething = false;
      let onlyDashes = true;
      let onlyAbsences = true;
      let lastType = null;

      days.forEach(d => {
        const v = (grid[emp][d] || "").trim();
        if (v) hasSomething = true;
        const low = v.toLowerCase();
        const isDash = v === "—" || v === "-" || v === "";
        const isAbs = /vacac|baja|permiso|formaci|descanso/.test(low);
        if (!isDash) onlyDashes = false;
        if (!isAbs)  onlyAbsences = false;
        if (isAbs) {
          if (/vacac/.test(low)) lastType = "vacaciones";
          else if (/baja/.test(low)) lastType = "baja";
          else if (/permiso/.test(low)) lastType = "permiso";
          else if (/formaci/.test(low)) lastType = "formacion";
          else if (/descanso/.test(low)) lastType = "descanso";
        }
      });

      if (onlyDashes) weekEmpty.add(emp);
      else if (onlyAbsences) { weekAbsent.add(emp); weekAbsenceType[emp] = lastType || "ausencia"; }
    });

    // Mapa sustituto predominante por ausente
    const mainSub = {};
    for (const emp of Object.keys(subCount)) {
      const pairs = Object.entries(subCount[emp]).sort((a,b)=>b[1]-a[1]);
      if (pairs.length) mainSub[emp] = pairs[0][0];
    }

    return { grid, meta, weekEmpty, weekAbsent, weekAbsenceType, mainSub };
  }

  // --- Render ---
  function render() {
    const app = $("#app"); if (!app) return;
    app.innerHTML = "";

    if (!SCHEDULE.length) { app.innerHTML = `<p class="meta">Sin datos.</p>`; return; }

    const days = weekDays(fromISO(state.weekISO));
    app.insertAdjacentHTML("beforeend", `<p class="meta">Semana ${mini(days[0])} → ${mini(days[6])}</p>`);

    const hotels = [...new Set(SCHEDULE.map(g => g.hotel))];

    hotels.forEach(hotel => {
      const g = byWeekHotel.get(state.weekISO + "||" + hotel);
      if (!g) return;

      const { grid, meta, weekEmpty, weekAbsent, weekAbsenceType, mainSub } = buildGrid(g, days);

      // Orden base del fichero
      const base = [...(g.orden_empleados || [])];

      // 1) Ocultar totalmente los 100% vacíos
      const visibles = base.filter(e => !weekEmpty.has(e));

      // 2) Reordenación según regla: ausentes toda la semana al final
      const present = visibles.filter(e => !weekAbsent.has(e));
      const absent  = visibles.filter(e =>  weekAbsent.has(e));

      // 3) Sustituto ocupa posición del ausente (principal en la semana)
      //    Insertamos sustituto si no está ya; el ausente lo mandamos al final.
      const ordered = [];
      const seen = new Set();

      present.forEach(e => { if (!seen.has(e)) { ordered.push(e); seen.add(e); } });

      base.forEach(e => {
        if (!weekAbsent.has(e)) return;
        const sub = mainSub[e];
        if (sub && !seen.has(sub)) { ordered.push(sub); seen.add(sub); }
      });

      // Empujamos ausentes al final (vacaciones/baja/…)
      absent.forEach(e => { if (!seen.has(e)) { ordered.push(e); seen.add(e); } });

      if (!ordered.length) return; // nada que mostrar

      // Tarjeta
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

      ordered.forEach(emp => {
        const tr = document.createElement("tr");
        let tds = `<td style="text-align:left">${fix(emp)}</td>`;
        days.forEach(d => {
          let lab = withCanonicalEmoji(rawLabel(grid[emp]?.[d]));
          const low = (lab || "").toLowerCase();
          let cls = "";
          if (/vacaciones|baja|permiso|formaci|descanso/.test(low)) cls = "turno-descanso";
          else if (/noche/.test(low)) cls = "turno-noche";
          else if (/tarde/.test(low)) cls = "turno-tarde";
          else if (/mañana|manana/.test(low)) cls = "turno-mañana";

          const swap = meta[emp]?.[d]?.isSub ? " ↔" : "";
          tds += `<td>${ lab ? `<span class="turno-pill ${cls}">${lab}${swap}</span>` : "—" }</td>`;
        });
        tr.innerHTML = tds;
        tbody.appendChild(tr);
      });

      app.appendChild(card);
    });
  }

  // --- Navegación ---
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
