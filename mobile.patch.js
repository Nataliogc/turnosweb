/* Turnos Web · mobile.patch.js (vista móvil)
   - Autorrender semana más cercana
   - Navegación (← / Hoy / →) por semanas existentes
   - Limpieza de mojibake + emojis canónicos
   - Ausencias: 🏖️ 🤒 🗓️ 🎓 / Cambio 🔄 / Noche 🌙
   - Oculta filas 100% “—”
   - Si hay vacaciones/baja toda la semana: al final; el sustituto ocupa su lugar
   - Modal Filtros (Hotel/Empleado/Desde/Hasta) integrado
*/
(function () {
  "use strict";
  const $ = (s, ctx = document) => ctx.querySelector(s);
  const DAY = 86400000;

  // ---------- Limpieza de mojibake / controles ----------
  function fix(s) {
    if (typeof s !== "string") return s;
    const map = [
      [/Ã¡/g, "á"], [/Ã©/g, "é"], [/Ã­/g, "í"], [/Ã³/g, "ó"], [/Ãº/g, "ú"],
      [/Ã±/g, "ñ"], [/Ã‘/g, "Ñ"], [/Ã¼/g, "ü"], [/Â¿/g, "¿"], [/Â¡/g, "¡"],
      [/Âº/g, "º"], [/Âª/g, "ª"], [/Â·/g, "·"]
    ];
    let out = s;
    for (const [re, rep] of map) out = out.replace(re, rep);

    // Controles invisibles (incluye U+009F '')
    out = out.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

    // Secuencias típicas de mojibake con emojis
    out = out
      .replace(/ð[\u0080-\u00FF\-–—”“"'\u00A0-\u00FF]*/g, "")
      .replace(/Â[\u0080-\u00FF\-–—”“"'\u00A0-\u00FF]*/g, "")
      .replace(/ï¸[\u0080-\u00FF\-–—”“"'\u00A0-\u00FF]*/g, "")
      .replace(/\uFFFD/g, "")
      .replace(/[Ÿ ]/g, "");

    // Restos vistos (p.ej. "¤’")
    out = out.replace(/[¤’‚‹›˘]/g, "");

    return out.trim().replace(/\s{2,}/g, " ");
  }

  // ---------- Fechas ----------
  const iso = d => { const x=new Date(d); x.setHours(0,0,0,0);
    return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const fromISO = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
  const monday = d => { const x=new Date(d); const w=(x.getDay()+6)%7; x.setHours(0,0,0,0); x.setDate(x.getDate()-w); return x; };
  const weekDays = mon => Array.from({length:7},(_,i)=>iso(new Date(mon.getTime()+i*DAY)));
  const mini = s => { const dt = fromISO(s);
    return dt.toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"2-digit"}).toLowerCase(); };

  // ---------- Datos ----------
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

  // ---------- Interpretación + emojis ----------
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

    // quitar flechas/comillas rotas
    out = out.replace(/[↔→←”“„]/g, "").trim().replace(/\s{2,}/g, " ");
    return out;
  }

  // ---------- Construcción de grid + sustitutos ----------
  function buildGrid(group, days) {
    const grid = {}, meta = {};
    const subCount = {}; // {EmpleadoAusente: {Sustituto: veces}}

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

    const weekEmpty = new Set();
    const weekAbsent = new Set();
    (group.orden_empleados || []).forEach(emp => {
      let onlyDashes = true;
      let onlyAbsences = true;
      days.forEach(d => {
        const v = (grid[emp][d] || "").trim();
        const low = v.toLowerCase();
        const isDash = v === "—" || v === "-" || v === "";
        const isAbs = /vacac|baja|permiso|formaci|descanso/.test(low);
        if (!isDash) onlyDashes = false;
        if (!isAbs)  onlyAbsences = false;
      });
      if (onlyDashes) weekEmpty.add(emp);
      else if (onlyAbsences) weekAbsent.add(emp);
    });

    const mainSub = {};
    for (const emp of Object.keys(subCount)) {
      const pairs = Object.entries(subCount[emp]).sort((a,b)=>b[1]-a[1]);
      if (pairs.length) mainSub[emp] = pairs[0][0];
    }

    return { grid, meta, weekEmpty, weekAbsent, mainSub };
  }

  // ---------- Render ----------
  function render() {
    const app = $("#app"); if (!app) return;
    app.innerHTML = "";

    if (!SCHEDULE.length) { app.innerHTML = `<p class="meta">Sin datos.</p>`; return; }

    const days = weekDays(fromISO(state.weekISO));
    app.insertAdjacentHTML("beforeend", `<p class="meta">Semana ${mini(days[0])} → ${mini(days[6])}</p>`);

    // Filtros activos
    const f = window.__TW_STATE__?.filters || {};
    let hotelsAll = [...new Set(SCHEDULE.map(g => g.hotel))];
    if (f.hotel) hotelsAll = hotelsAll.filter(h => h === f.hotel);

    hotelsAll.forEach(hotel => {
      const g = byWeekHotel.get(state.weekISO + "||" + hotel);
      if (!g) return;

      const { grid, meta, weekEmpty, weekAbsent, mainSub } = buildGrid(g, days);

      const base = [...(g.orden_empleados || [])];
      const visibles = base.filter(e => !weekEmpty.has(e));
      const present = visibles.filter(e => !weekAbsent.has(e));
      const absent  = visibles.filter(e =>  weekAbsent.has(e));

      const ordered = [];
      const seen = new Set();
      present.forEach(e => { if (!seen.has(e)) { ordered.push(e); seen.add(e); } });
      base.forEach(e => {
        if (!weekAbsent.has(e)) return;
        const sub = mainSub[e];
        if (sub && !seen.has(sub)) { ordered.push(sub); seen.add(sub); }
      });
      absent.forEach(e => { if (!seen.has(e)) { ordered.push(e); seen.add(e); } });

      let order = ordered;
      if (f.empleado) order = order.filter(x => x === f.empleado);
      if (!order.length) return;

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

  // Hooks públicos para filtros
  window.__TW_RERENDER = () => render();
  window.__TW_MOVE_TO_WEEK = (isoWeek) => { state.weekISO = isoWeek; render(); };
  window.__TW_MOVE_TO_NEAREST = (isoWeek) => {
    const toDate = (s)=>{const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d);};
    const target = toDate(isoWeek);
    if (!WEEKS.length) return;
    const nearest = WEEKS.slice().sort((a,b)=> Math.abs(toDate(a)-target)-Math.abs(toDate(b)-target))[0];
    state.weekISO = nearest; render();
  };

  // Navegación
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

// ========= Bloque de Filtros =========
(function () {
  const $ = (s, c=document) => c.querySelector(s);

  const fstate = { hotel: null, empleado: null, desde: null, hasta: null };
  if (!window.__TW_STATE__) window.__TW_STATE__ = {};
  window.__TW_STATE__.filters = fstate;

  // Acepta “dd/mm/aaaa” y también “ddmmaa” (p.ej. 010125 → 01/01/2025)
  function parseEs(str) {
    if (!str) return null;
    const s = str.trim();
    if (/^\d{6}$/.test(s)) {
      const dd = s.slice(0,2), mm = s.slice(2,4), aa = s.slice(4,6);
      return parseEs(`${dd}/${mm}/20${aa}`);
    }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return null;
    const [dd,mm,yy] = s.split("/").map(Number);
    const d = new Date(yy, mm-1, dd); d.setHours(0,0,0,0);
    return (d.getFullYear()===yy && d.getMonth()===(mm-1) && d.getDate()===dd) ? d : null;
  }

  function populate() {
    const selHotel = $("#fHotel");
    const selEmp   = $("#fEmpleado");
    if (!selHotel || !selEmp) return;

    const sched = (window.FULL_DATA?.schedule || window.DATA?.schedule || []);
    const hotels = [...new Set(sched.map(g => g.hotel))].sort((a,b)=>a.localeCompare(b,"es"));
    selHotel.innerHTML = `<option value="">— Hotel —</option>` + hotels.map(h=>`<option>${h}</option>`).join("");

    function fillEmployees(hFilter) {
      const emps = new Set();
      sched.forEach(g => {
        if (hFilter && g.hotel !== hFilter) return;
        (g.orden_empleados || []).forEach(e => emps.add(e));
        (g.turnos || []).forEach(t => { if (t?.empleado) emps.add(t.empleado); const su=t?.turno?.Sustituto; if (su) emps.add(su); });
      });
      const list = [...emps].sort((a,b)=>a.localeCompare(b,"es"));
      selEmp.innerHTML = `<option value="">— Empleado —</option>` + list.map(e=>`<option>${e}</option>`).join("");
    }
    fillEmployees(null);

    selHotel.onchange = () => { fstate.hotel = selHotel.value || null; fillEmployees(fstate.hotel); selEmp.value=""; fstate.empleado=null; };
    selEmp.onchange   = () => { fstate.empleado = selEmp.value || null; };
  }

  function wire() {
    const btnApply = $("#fApply"), btnClose = $("#fClose");
    const iDesde = $("#fDesde"), iHasta = $("#fHasta");
    if (!btnApply) return;

    btnApply.onclick = (e) => {
      e.preventDefault();
      const d = parseEs(iDesde?.value || "");
      const h = parseEs(iHasta?.value || "");
      fstate.desde = d; fstate.hasta = h;

      if (d) {
        const m = new Date(d); m.setDate(m.getDate() - ((m.getDay()+6)%7)); m.setHours(0,0,0,0);
        const iso = (x)=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
        const target = iso(m);
        if (window.__TW_MOVE_TO_WEEK) window.__TW_MOVE_TO_WEEK(target);
        else if (window.__TW_MOVE_TO_NEAREST) window.__TW_MOVE_TO_NEAREST(target);
      }

      window.__TW_RERENDER && window.__TW_RERENDER();
      document.getElementById('dlgFilters')?.close();
    };

    if (btnClose) btnClose.onclick = (e) => { e.preventDefault(); document.getElementById('dlgFilters')?.close(); };
  }

  document.addEventListener("DOMContentLoaded", () => { populate(); wire(); });
})();
