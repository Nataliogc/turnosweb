/* ===========================================================================
 * APP MÓVIL · Turnos Recepción (España)
 * - Semana L→D, una debajo de otra
 * - Estética y colores como "live"
 * - Sin contadores junto al nombre
 * - Fechas robustas (sin toISOString, sin desfases)
 * ==========================================================================*/
(function () {
  "use strict";

  // ---------- Utilidades ----------
  const MS = 86400000;

  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const byId = (id) => document.getElementById(id);

  const pad = (n) => (n < 10 ? "0" + n : "" + n);

  const monday = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    const wd = (x.getDay() + 6) % 7; // 0=>lunes
    return new Date(x.getTime() - wd * MS);
  };
  const addDays = (d, n) => new Date(new Date(d).getTime() + n * MS);

  const fmtYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fmtDateCell = (d) => {
    // ej. "27/oct/25"
    const dd = pad(d.getDate());
    const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    return `${dd}/${meses[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
  };
  const DOW = ["LUNES","MARTES","MIÉRCOLES","JUEVES","VIERNES","SÁBADO","DOMINGO"];

  const normalize = (s) =>
    s == null ? "" : (typeof s === "object" ? "" : String(s));

  const cleanTurno = (t) => {
    let s = normalize(t);
    if (!s) return "";
    const base = s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    if (base.includes("vacacion"))  return "VACACIONES";
    if (base.includes("descanso"))  return "DESCANSO";
    if (base.includes("noche"))     return "NOCHE";
    if (base.includes("tarde"))     return "TARDE";
    if (base.includes("manana") || base.includes("mañana")) return "MAÑANA";
    return s;
  };

  // ---------- Datos & Estado ----------
  function normalizeRows(FD) {
    // Acepta FULL_DATA.schedule (preferente) o FULL_DATA.data ya aplanados
    const S = Array.isArray(FD?.schedule) ? FD.schedule : FD?.data || [];
    if (!S.length) return [];

    // Caso 1: schedule = [{hotel, turnos:[{empleado, fecha, turno}]}]
    if (S[0] && Array.isArray(S[0].turnos)) {
      const out = [];
      for (const w of S) {
        const hotel = w.hotel || w.Hotel || w.establecimiento || w?.meta?.hotel || "";
        for (const t of w.turnos || []) {
          out.push({
            hotel,
            empleado: t.empleado || t.employee || t.nombre || t.name || t.persona || "",
            fecha:    t.fecha    || t.date     || t.dia    || t.day   || "",
            turno:    t.turno    || t.shift    || t.tramo  || ""
          });
        }
      }
      return out;
    }
    // Caso 2: ya aplanado
    return S.map(r => ({
      hotel:    r.hotel    || r.Hotel || r.establecimiento || r?.meta?.hotel || "",
      empleado: r.empleado || r.employee || r.nombre || r.name || r.persona || "",
      fecha:    r.fecha    || r.date || r.dia || r.day || "",
      turno:    r.turno    || r.shift || r.tramo || ""
    }));
  }

  const STATE = {
    rows: [],
    from: monday(new Date()),
    to:   addDays(monday(new Date()), 7*4 - 1), // semana actual + 3 (4 semanas visibles)
    hotel: "",
    empleado: ""
  };

  // ---------- Render ----------
  function render() {
    const app = byId("app");
    if (!app) return;

    // Filtro por rango / hotel / empleado
    const inRange = (r) => {
      const ds = r.fecha;
      if (!ds) return false;
      const d = new Date(ds);
      return d >= STATE.from && d <= STATE.to &&
             (!STATE.hotel    || r.hotel    === STATE.hotel) &&
             (!STATE.empleado || r.empleado === STATE.empleado);
    };

    const rows = STATE.rows.filter(inRange);

    // Agrupar por hotel y semana (clave por ms para evitar desfases)
    const groups = new Map(); // key: `${hotel}__${msMonday}`, value: {ms, hotel, items:[]}
    for (const r of rows) {
      const d = new Date(r.fecha);
      const mon = monday(d).getTime();
      const key = `${r.hotel}__${mon}`;
      if (!groups.has(key)) groups.set(key, { ms: mon, hotel: r.hotel, items: [] });
      groups.get(key).items.push(r);
    }

    // Orden de hoteles (Cumbria primero)
    const hotelOrder = (h) => {
      const low = String(h).toLowerCase();
      if (low.includes("cumbria"))  return 0;
      if (low.includes("guadiana")) return 1;
      return 2;
    };

    const weekKeys = [...groups.keys()].sort((a,b) => {
      const [ha, ma] = a.split("__"); const [hb, mb] = b.split("__");
      if (Number(ma) !== Number(mb)) return Number(ma) - Number(mb);
      return hotelOrder(ha) - hotelOrder(hb);
    });

    // Píldoras como "live"
    const pill = (turno) => {
      const t = cleanTurno(turno);
      if (t === "MAÑANA")   return `<span class="pill pill-m">Mañana</span>`;
      if (t === "TARDE")    return `<span class="pill pill-t">Tarde</span>`;
      if (t === "NOCHE")    return `<span class="pill pill-n">Noche 🌙</span>`;
      if (t === "DESCANSO") return `<span class="pill pill-x">Descanso</span>`;
      if (t === "VACACIONES") return `<span class="pill pill-m">Vacaciones 🎉</span>`;
      return t || "—";
    };

    const logoFor = (hotel) =>
      String(hotel).toLowerCase().includes("guadiana") ? "img/guadiana.jpg" : "img/cumbria.jpg";

    // Contenido
    let html = "";
    for (const key of weekKeys) {
      const { ms, hotel, items } = groups.get(key);
      const weekStart = new Date(ms);

      // Fechas L→D
      const days = Array.from({length:7}, (_,i) => addDays(weekStart, i));
      const ymd  = days.map(fmtYMD);

      // Orden estable de empleados (según primera aparición en la semana)
      const seen = new Map();
      items.forEach((r, idx) => {
        if (!seen.has(r.empleado)) seen.set(r.empleado, idx);
      });
      const empleados = [...seen.keys()].sort((a,b) => seen.get(a) - seen.get(b));

      // Mapa emp -> fecha -> turno
      const mp = new Map();
      for (const r of items) {
        const e = r.empleado;
        const f = fmtYMD(new Date(r.fecha)); // local
        const t = r.turno;
        if (!mp.has(e)) mp.set(e, {});
        mp.get(e)[f] = t;
      }

      // Cabecera (Semana NN/mm/aaaa)
      const isoWeek = (d) => {
        // ISO week number
        const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = (tmp.getUTCDay() + 6) % 7;
        tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
        const firstThu = new Date(Date.UTC(tmp.getUTCFullYear(),0,4));
        const diff = (tmp - firstThu)/86400000;
        return 1 + Math.floor(diff/7);
      };
      const sem = String(isoWeek(weekStart)).padStart(2,"0");
      const title = `${hotel} – Semana ${sem}/${weekStart.getMonth()+1}/${weekStart.getFullYear()}`;

      const headCols = days.map((d,i) =>
        `<th>
            <div class="dow">${DOW[i]}</div>
            <div class="dmy">${fmtDateCell(d)}</div>
         </th>`
      ).join("");

      const bodyRows = empleados.map(emp => {
        const byDate = mp.get(emp) || {};
        return `<tr>
          <td class="emp"><strong>${emp}</strong></td>
          ${ymd.map((d) => `<td>${pill(byDate[d])}</td>`).join("")}
        </tr>`;
      }).join("");

      html += `
        <div class="row-card">
          <table class="grid-week">
            <thead>
              <tr>
                <th colspan="8" class="week-title">
                  <img src="${logoFor(hotel)}" alt="${hotel}" class="hotel-logo">
                  ${title}
                </th>
              </tr>
              <tr>
                <th class="col-emp">Empleado</th>
                ${headCols}
              </tr>
            </thead>
            <tbody>
              ${bodyRows || `<tr><td colspan="8" class="nodata">—</td></tr>`}
            </tbody>
          </table>
        </div>`;
    }

    app.innerHTML = html || `<p class="meta">Listo. Abre <strong>Filtros</strong>, elige Hotel/Rango y pulsa <strong>Aplicar</strong>.</p>`;
  }

  // ---------- Filtros ----------
  function populateFilters() {
    const hotelSel = byId("hotelSelect");
    const empSel   = byId("employeeFilter");
    if (!hotelSel || !empSel) return;

    const hotels = [...new Set(STATE.rows.map(r => r.hotel))];
    hotels.sort((a,b)=>{
      const order = (h)=>/cumbria/i.test(h)?0:/guadiana/i.test(h)?1:2;
      const sa = order(a), sb = order(b);
      return sa===sb ? String(a).localeCompare(String(b),"es") : sa - sb;
    });

    hotelSel.innerHTML = `<option value="">— Hotel —</option>` +
      hotels.map(h=>`<option>${h}</option>`).join("");

    const refreshEmp = ()=>{
      const list = [...new Set(
        STATE.rows.filter(r => !hotelSel.value || r.hotel === hotelSel.value)
                  .map(r => r.empleado)
      )].sort((a,b)=>String(a).localeCompare(String(b),"es"));
      empSel.innerHTML = `<option value="">— Empleado —</option>` +
        list.map(n=>`<option>${n}</option>`).join("");
    };
    refreshEmp();
    hotelSel.onchange = refreshEmp;

    // Fechas por defecto en el panel
    const toISO = (d)=>fmtYMD(d);
    byId("dateFrom").value = toISO(STATE.from);
    byId("dateTo").value   = toISO(STATE.to);
  }

  function attachUI() {
    byId("btnPrev")?.addEventListener("click", ()=>{
      STATE.from = addDays(STATE.from, -7);
      STATE.to   = addDays(STATE.to,   -7);
      render();
    });
    byId("btnNext")?.addEventListener("click", ()=>{
      STATE.from = addDays(STATE.from, 7);
      STATE.to   = addDays(STATE.to,   7);
      render();
    });
    byId("btnToday")?.addEventListener("click", ()=>{
      STATE.from = monday(new Date());
      STATE.to   = addDays(STATE.from, 7*4 - 1);
      render();
    });

    const dlg = byId("dlg");
    byId("btnFilters")?.addEventListener("click", ()=> dlg?.showModal());
    byId("btnApply")?.addEventListener("click", (e)=>{
      e.preventDefault();
      STATE.hotel    = byId("hotelSelect")?.value || "";
      STATE.empleado = byId("employeeFilter")?.value || "";
      const f = byId("dateFrom")?.value;
      const t = byId("dateTo")?.value;
      if (f) STATE.from = monday(new Date(f));
      if (t) STATE.to   = addDays(monday(new Date(t)), 6);
      dlg?.close();
      render();
    });
  }

  // ---------- Boot ----------
  window.addEventListener("DOMContentLoaded", ()=>{
    try {
      STATE.rows = normalizeRows(window.FULL_DATA || {});
      STATE.from = monday(new Date());
      STATE.to   = addDays(STATE.from, 7*4 - 1);

      populateFilters();
      attachUI();
      render();
    } catch (e) {
      const app = byId("app");
      if (app) app.innerHTML = `<p class="meta">No se pudo iniciar la APP: ${e?.message || e}</p>`;
      console.error(e);
    }
  });

  // API compatible
  window.renderContent = () => render();
})();
