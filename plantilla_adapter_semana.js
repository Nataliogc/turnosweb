/* plantilla_adapter_semana.js — v36.0-lts (estable) */
(function () {
  // ---------- Config de logos (rutas relativas para GitHub Pages y local) ----------
  const HOTEL_LOGOS = {
    "Sercotel Guadiana": "./img/guadiana.jpg",
    "Cumbria Spa&Hotel": "./img/cumbria.jpg",
  };

  // ---------- Helpers de fecha ----------
  const MONTHS_SHORT_CAP = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const MONTHS_SHORT_MIN = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const MONTHS_FULL = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

  const isoLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,"0");
    const day = String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${day}`;
  };
  const toISO = (s) => {
    if (!s) return isoLocal(new Date());
    if (s instanceof Date) return isoLocal(s);
    const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return String(s);
    return isoLocal(new Date(s));
  };
  const fromISO = (iso) => { const [y,m,d] = iso.split("-").map(x=>parseInt(x,10)); return new Date(y,m-1,d); };
  const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate()+n); return isoLocal(d); };
  const startOfWeekMonday = (iso) => { const d = fromISO(iso); const off = (d.getDay()===0 ? -6 : 1 - d.getDay()); d.setDate(d.getDate()+off); return isoLocal(d); };
  const fmtDayLabelLower = (iso) => { const d=fromISO(iso); const dd=String(d.getDate()).padStart(2,"0"); const mm=MONTHS_SHORT_MIN[d.getMonth()]; const yy=String(d.getFullYear()).slice(-2); return `${dd}/${mm}/${yy}`; };
  const monthHuman = (ym) => { const [y,m]=ym.split("-"); return `${MONTHS_FULL[parseInt(m,10)-1]} de ${y}`; };
  const weekNumberISO = (iso) => { const d=fromISO(iso); d.setHours(0,0,0,0); const day=d.getDay()||7; d.setDate(d.getDate()+4-day); const yearStart=new Date(d.getFullYear(),0,1); return Math.ceil((((d-yearStart)/86400000)+1)/7); };

  // ---------- Empleados visibles ----------
  function getVisibleEmployees(data, filters) {
    const from = fromISO(filters.dateFrom), to = fromISO(filters.dateTo);
    const set = new Set();
    (data.schedule || []).forEach(g => {
      if (filters.hotel && g.hotel !== filters.hotel) return;
      g.turnos.forEach(t => {
        const dt = fromISO(t.fecha);
        if (dt < from || dt > to) return;
        set.add(t.empleado);
        if (t.turno && typeof t.turno === "object" && t.turno.Sustituto) set.add(t.turno.Sustituto);
      });
    });
    return Array.from(set).sort();
  }

  // ---------- Construcción de parrilla ----------
  function buildWeekGrid(hotelGroup, weekDays){
    const grid = {}, meta = {};
    const absenceCount = {};
    const subCandidate = {};

    const allEmployees = new Set(hotelGroup.orden_empleados || []);
    hotelGroup.turnos.forEach(t => { if (typeof t.turno === "object" && t.turno.Sustituto) allEmployees.add(t.turno.Sustituto); });
    allEmployees.forEach(emp => { grid[emp]={}; meta[emp]={}; weekDays.forEach(d => { grid[emp][d]=""; meta[emp][d]=null; }); });

    // Carga base
    hotelGroup.turnos.forEach(t => { if (grid[t.empleado]) grid[t.empleado][t.fecha] = t.turno; });

    // Ausencias + sustituciones
    for (const emp of allEmployees) {
      for (const day of weekDays) {
        const raw = grid[emp]?.[day];
        if (typeof raw === "object" && raw !== null) {
          const exact = (raw.TipoInterpretado ?? raw.TipoAusencia ?? raw["Tipo Ausencia"] ?? "").toString().trim();
          const etiqueta = exact || "Ausencia";
          grid[emp][day] = etiqueta;
          meta[emp][day] = Object.assign({}, meta[emp][day], { isAbsence: true, absenceLabel: etiqueta });
          absenceCount[emp] = (absenceCount[emp] || 0) + 1;

          const sust = raw.Sustituto;
          if (sust) {
            grid[sust][day] = raw.TurnoOriginal;
            meta[sust][day] = { isSub: true, for: emp, turno: raw.TurnoOriginal };
            if (!subCandidate[emp]) subCandidate[emp] = sust;
          }
        }
      }
    }
    return {grid, meta, absenceCount, subCandidate};
  }

  const beautifyLabel = (label) => {
    let out = label || "";
    if (typeof out === "string" && /^n(oche)?/i.test(out) && !out.includes("🌙")) out = `${out} 🌙`;
    return out;
  };

  // ---------- Render de una semana de un hotel ----------
  function renderHotelWeek(container, hotelGroup, weekDays, filters) {
    const {grid, meta, absenceCount, subCandidate} = buildWeekGrid(hotelGroup, weekDays);

    const weekAbsent = new Set(Object.keys(absenceCount).filter(emp => absenceCount[emp] === weekDays.length));

    let display = (hotelGroup.orden_empleados || []).map(e => weekAbsent.has(e) ? (subCandidate[e] || e) : e).filter(Boolean);
    display = [...new Set(display)];
    display = display.filter(e => !weekAbsent.has(e));
    display.push(...Array.from(weekAbsent));

    if (filters.employee) display = display.filter(e => e === filters.employee);
    display = display.filter(emp => weekDays.some(day => (grid[emp] && grid[emp][day])));
    if (display.length === 0) return;

    const headers = weekDays.map(d => {
      const date = fromISO(d);
      const weekday = date.toLocaleDateString("es-ES",{weekday:"long"});
      return `<th><span class="day-name">${weekday.toUpperCase()}</span><br><span class="day-number">${fmtDayLabelLower(d)}</span></th>`;
    }).join("");

    const body = display.map(emp => {
      const tds = weekDays.map(day => {
        let label = grid[emp]?.[day] || "";
        label = beautifyLabel(label);
        const cls = `turno-${(label || "default").toLowerCase().split(" ")[0].normalize("NFD").replace(/[\u0300-\u036f]/g,"")}`;
        const m = meta[emp][day];
        const mark = m && m.isSub ? ` <small title="Sustituto de ${m.for}">↔︎</small>` : "";
        return `<td><span class="turno-pill ${cls}">${label}${mark}</span></td>`;
      }).join("");
      return `<tr><td>${emp}</td>${tds}</tr>`;
    }).join("");

    const logo = HOTEL_LOGOS[hotelGroup.hotel] || "";
    const logoHtml = logo ? `<img class="hotel-logo" src="${logo}" alt="${hotelGroup.hotel}" onerror="this.remove()">` : "";

    const wnum = weekNumberISO(weekDays[0]);
    const d0 = fromISO(weekDays[0]);
    const monthYear = `${MONTHS_SHORT_CAP[d0.getMonth()]}/${d0.getFullYear()}`;

    const weekHTML =
      `<div class="week">
         <div class="week-head">
           ${logoHtml}
           <h3>${hotelGroup.hotel} - Semana ${wnum}/${monthYear}</h3>
         </div>
         <div class="table-container">
           <table>
             <thead><tr><th>Empleado</th>${headers}</tr></thead>
             <tbody>${body}</tbody>
           </table>
         </div>
       </div>`;
    container.insertAdjacentHTML("beforeend", weekHTML);
  }

  // ---------- Resumen mensual ----------
  function renderMonthlySummary(data, filters) {
    const box = document.getElementById("monthly-summary-container");
    if (!box) return;
    box.innerHTML = "";
    const rows = data.schedule || [];
    if (!rows.length) return;

    const from = fromISO(filters.dateFrom), to = fromISO(filters.dateTo);
    const byEmp = {};

    for (const g of rows) {
      if (filters.hotel && g.hotel !== filters.hotel) continue;
      for (const t of g.turnos) {
        const dt = fromISO(t.fecha);
        if (dt < from || dt > to) continue;

        let turnoReal = t.turno, empleadoReal = t.empleado;
        if (typeof t.turno === "object" && t.turno !== null) {
          turnoReal = t.turno.TurnoOriginal || "";
          empleadoReal = (t.turno.Sustituto || t.empleado);
        }
        if (typeof turnoReal === "string" && /^n/i.test(turnoReal.trim())) {
          const m = t.fecha.slice(0, 7);
          byEmp[m] ||= {}; byEmp[m][g.hotel] ||= {};
          byEmp[m][g.hotel][empleadoReal] = (byEmp[m][g.hotel][empleadoReal] || 0) + 1;
        }
      }
    }

    const months = Object.keys(byEmp).sort();
    if (!months.length) return;

    let html = "";
    for (const ym of months) {
      html += `<h3 style="margin:1rem 0 0">${monthHuman(ym)}</h3>`;
      const hotels = Object.keys(byEmp[ym]).sort();
      for (const h of hotels) {
        const entries = Object.entries(byEmp[ym][h]).sort((a,b)=>a[0].localeCompare(b[0]));
        html += `<div class='table-container' style="margin:.5rem 0 1rem">
          <table>
            <thead><tr><th>${h}</th><th>Noches</th></tr></thead>
            <tbody>${entries.map(([emp, n]) => `<tr><td>${emp}</td><td>${n}</td></tr>`).join("")}</tbody>
          </table>
        </div>`;
      }
    }
    box.innerHTML = html;
  }

  function updateHeaderSubtitle(hotel) {
    const el = document.querySelector(".title-block .subtitle");
    if (!el) return;
    el.textContent = hotel ? hotel : "Sercotel Guadiana / Cumbria Spa&Hotel";
  }

  // ---------- UI helpers ----------
  function currentFilters() {
    const hotelEl = document.getElementById("hotelSelect");
    const empEl   = document.getElementById("employeeFilter");
    const dfEl    = document.getElementById("dateFrom");
    const dtEl    = document.getElementById("dateTo");
    const hotel    = hotelEl ? (hotelEl.value || "") : "";
    const employee = empEl   ? (empEl.value   || "") : "";
    const dateFrom = dfEl    ? toISO(dfEl.value) : toISO(new Date());
    const dateTo   = dtEl    ? toISO(dtEl.value) : toISO(new Date(fromISO(dateFrom).getTime()+30*24*3600*1000));
    return { hotel, employee, dateFrom, dateTo };
  }

  function getVisibleEmployeesWrapper(data){
    try { return getVisibleEmployees(data, currentFilters()); }
    catch(e){ return []; }
  }

  function refreshEmployeeOptions(data) {
    const list = getVisibleEmployeesWrapper(data);
    const empFilter = document.getElementById("employeeFilter");
    const empIcs = document.getElementById("employeeSelectIcs");
    if (!empFilter || !empIcs) return;

    const prev1 = empFilter.value, prev2 = empIcs.value;
    const opts1 = `<option value="">— Empleado —</option>` + list.map(e => `<option value="${e}">${e}</option>`).join("");
    const opts2 = `<option value="">— Exportar Horario de... —</option>` + list.map(e => `<option value="${e}">${e}</option>`).join("");
    empFilter.innerHTML = opts1; empIcs.innerHTML = opts2;
    empFilter.value = list.includes(prev1) ? prev1 : "";
    empIcs.value    = list.includes(prev2) ? prev2 : "";
  }

  // ---------- Render principal ----------
  function renderContent(data, filters) {
    const app = document.getElementById("app");
    if (!app) return;
    app.innerHTML = "";
    updateHeaderSubtitle(filters.hotel);

    if (!data || !Array.isArray(data.schedule) || data.schedule.length === 0) {
      app.innerHTML = "<p style='padding:1rem;color:#6c757d'>No hay datos para mostrar.</p>";
      const sum = document.getElementById("monthly-summary-container");
      if (sum) sum.innerHTML = "";
      return;
    }

    let currentMonday = startOfWeekMonday(filters.dateFrom);
    const end = fromISO(filters.dateTo);
    while (fromISO(currentMonday) <= end) {
      const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentMonday, i));
      const groups = data.schedule.filter(g => g.semana_lunes === currentMonday);
      if (filters.hotel) {
        const g = groups.find(x => x.hotel === filters.hotel);
        if (g) renderHotelWeek(app, g, weekDays, filters);
      } else {
        groups.forEach(g => renderHotelWeek(app, g, weekDays, filters));
      }
      currentMonday = addDays(currentMonday, 7);
    }
    renderMonthlySummary(data, filters);
  }

  // ---------- Ready ----------
  document.addEventListener("DOMContentLoaded", () => {
    const data = window.FULL_DATA || window.DATA || {};
    // Filtros
    const hotelSelect = document.getElementById("hotelSelect");
    const dateFrom = document.getElementById("dateFrom");
    const dateTo = document.getElementById("dateTo");
    const empFilter = document.getElementById("employeeFilter");
    const empIcs = document.getElementById("employeeSelectIcs");
    const btnICS = document.getElementById("btnICS");
    const btnRefresh = document.getElementById("btnRefresh");

    // Rellenar hoteles
    if (hotelSelect) {
      const hotels = [...new Set((data.schedule || []).map(g => g.hotel))].sort();
      hotelSelect.innerHTML = `<option value="">— Hotel —</option>` + hotels.map(h => `<option value="${h}">${h}</option>`).join("");
    }

    // Flatpickr (robusto)
    const today = toISO(new Date());
    const plus30 = toISO(new Date(fromISO(today).getTime() + 30*24*3600*1000));
    if (window.flatpickr && dateFrom && dateTo) {
      flatpickr.localize(flatpickr.l10ns.es);
      const isWide = window.matchMedia("(min-width: 992px)").matches;
      let fpTo;
      flatpickr(dateFrom, {
        defaultDate: today, dateFormat: "Y-m-d",
        altInput: true, altFormat: "d/M/Y",
        locale: "es", weekNumbers: true, disableMobile: true, showMonths: isWide ? 2 : 1,
        onChange: (sel) => {
          if (sel && sel[0] && fpTo) {
            const min = isoLocal(sel[0]);
            fpTo.set("minDate", min);
            const curTo = toISO(dateTo.value);
            if (fromISO(curTo) < fromISO(min)) { fpTo.setDate(addDays(min, 30), true); }
          }
          refreshEmployeeOptions(data);
          renderContent(data, currentFilters());
        }
      });
      fpTo = flatpickr(dateTo, {
        defaultDate: plus30, dateFormat: "Y-m-d",
        altInput: true, altFormat: "d/M/Y",
        locale: "es", weekNumbers: true, disableMobile: true, showMonths: isWide ? 2 : 1,
        minDate: today,
        onChange: () => { refreshEmployeeOptions(data); renderContent(data, currentFilters()); }
      });
    } else {
      if (dateFrom) dateFrom.value = today;
      if (dateTo)   dateTo.value = plus30;
    }

    refreshEmployeeOptions(data);
    renderContent(data, currentFilters());

    // Listeners (seguros)
    ["hotelSelect","dateFrom","dateTo"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", () => { refreshEmployeeOptions(data); renderContent(data, currentFilters()); });
      el.addEventListener("input",  () => { refreshEmployeeOptions(data); renderContent(data, currentFilters()); });
    });
    if (empFilter) empFilter.addEventListener("change", () => renderContent(data, currentFilters()));
    if (btnRefresh) btnRefresh.addEventListener("click", () => renderContent(data, currentFilters()));

    if (btnICS && empIcs) {
      btnICS.addEventListener("click", () => {
        const who = empIcs.value;
        if (!who) return alert("Elige un empleado para exportar.");
        const filters = currentFilters();

        const events = [];
        let currentMonday = startOfWeekMonday(filters.dateFrom);
        const end = fromISO(filters.dateTo);
        while (fromISO(currentMonday) <= end) {
          const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentMonday, i));
          const groups = (data.schedule || []).filter(g => g.semana_lunes === currentMonday);
          const processGroup = (g) => {
            const {grid, meta} = buildWeekGrid(g, weekDays);
            for (const day of weekDays) {
              if (filters.hotel && g.hotel !== filters.hotel) continue;
              const labelRaw = (grid[who] && grid[who][day]) || "";
              if (!labelRaw) continue;
              let label = beautifyLabel(labelRaw);
              if (meta[who] && meta[who][day] && meta[who][day].isSub) label += " ↔︎";
              const date = day.replace(/-/g,"");
              events.push(`BEGIN:VEVENT\nDTSTART;VALUE=DATE:${date}\nDTEND;VALUE=DATE:${date}\nSUMMARY:${label}\nEND:VEVENT`);
            }
          };
          if (filters.hotel) {
            const g = groups.find(x => x.hotel === filters.hotel);
            if (g) processGroup(g);
          } else {
            groups.forEach(processGroup);
          }
          currentMonday = addDays(currentMonday, 7);
        }

        if (!events.length) { alert("No hay turnos en el rango seleccionado para ese empleado."); return; }
        const ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Turnos//CG//ES\n" + events.join("\n") + "\nEND:VCALENDAR";
        const blob = new Blob([ics], {type:"text/calendar;charset=utf-8"});
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `turnos_${who}.ics`; a.click(); URL.revokeObjectURL(a.href);
      });
    }
  });
})();
