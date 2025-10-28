// mobile.patch.js — APP con navegación arriba y fallback que entiende FULL_DATA.schedule[].turnos
(function () {
  const $ = s => document.querySelector(s);
  const unique = a => [...new Set(a.filter(Boolean))];
  const MS = 864e5;

  // ====== Lectura de datos ======
  const getData = () => window.FULL_DATA || {};

  // Convierte tu estructura semanal (obj.turnos[]) en filas planas
  function flattenRows(D) {
    const S = Array.isArray(D.schedule) ? D.schedule : [];
    if (!S.length) return Array.isArray(D.data) ? D.data : [];

    // ¿Es semanal? (primer elemento tiene array 'turnos')
    if (S[0] && Array.isArray(S[0].turnos)) {
      const out = [];
      for (const w of S) {
        const hotel = w.hotel || w.Hotel || w.establecimiento || w?.meta?.hotel || "";
        const base = { hotel };
        for (const t of (w.turnos || [])) {
          out.push({
            ...base,
            empleado: t.empleado || t.employee || t.nombre || t.name || t.persona || "",
            fecha:    t.fecha    || t.date    || t.dia   || t.day   || t?.meta?.fecha || "",
            turno:    t.turno    || t.shift   || t.tramo || t?.meta?.turno || ""
          });
        }
      }
      return out;
    }

    // Si ya es plano, lo devolvemos tal cual
    return S;
  }

  const hotelOf = r => r.hotel || r.Hotel || r.establecimiento || r?.meta?.hotel || "";
  const nameOf  = r => r.empleado || r.employee || r.nombre || r.name || r.persona || "";
  const dateOf  = r => r.fecha || r.date || r.dia || r.day || r?.meta?.fecha || "";
  const turnoOf = r => r.turno || r.shift || r.tramo || r?.meta?.turno || "";

  const hotelsFrom = D => {
    if (Array.isArray(D.hotels) && D.hotels.length) return unique(D.hotels);
    return unique(flattenRows(D).map(hotelOf));
  };

  const employeesFrom = (D, hotel) => {
    // si hay lista global de empleados, úsala; si no, dedúcela del hotel
    if (Array.isArray(D.employees) && D.employees.length) {
      return hotel ? D.employees.filter(e => e.hotel === hotel).map(e => e.name || e.empleado || e)
                   : D.employees.map(e => e.name || e.empleado || e);
    }
    return unique(flattenRows(D)
      .filter(x => !hotel || hotelOf(x) === hotel)
      .map(nameOf));
  };

  // ====== Espera a DOM + datos ======
  function whenReady(maxMs = 8000){
    return new Promise((resolve, reject) => {
      const t0 = performance.now();
      const iv = setInterval(() => {
        const domOK  = document.readyState === 'complete' || document.readyState === 'interactive';
        const rowsOK = flattenRows(getData()).length > 0 || hotelsFrom(getData()).length > 0;
        if (domOK && rowsOK) { clearInterval(iv); resolve(); }
        else if (performance.now() - t0 > maxMs) { clearInterval(iv); reject(new Error('timeout FULL_DATA/DOM')); }
      }, 100);
    });
  }

  // ====== Fallback de render semanal ======
  function ensureRender(){
    if (typeof window.renderContent === 'function') return;

    renderContent

    window.renderContent = function renderContent({dateFrom, dateTo, hotel, employee} = {}){
      const rowsAll = flattenRows(getData());

      // Filtro de rango
      const rows = rowsAll.filter(r => {
        if (hotel && hotelOf(r) !== hotel) return false;
        if (employee && nameOf(r) !== employee) return false;
        const d = dateOf(r);
        if (dateFrom && d && new Date(d) < new Date(dateFrom)) return false;
        if (dateTo   && d && new Date(d) > new Date(dateTo))   return false;
        return true;
      });

      const app = document.getElementById('app');
      if (!rows.length){
        app.innerHTML = `<p class="meta">No hay datos para mostrar con los filtros seleccionados.</p>`;
        return;
      }

      // Fechas (ordenadas) presentes en el rango
      const fechasOrden = unique(rows.map(dateOf)).sort((a,b)=>new Date(a)-new Date(b));

      // Agrupar por hotel y por empleado -> fecha
      const byHotel = {};
      for (const r of rows){
        const h = hotelOf(r) || '—';
        const n = nameOf(r)  || '—';
        const f = dateOf(r)  || '—';
        const t = turnoOf(r) || '';
        (byHotel[h] ??= {});
        (byHotel[h][n] ??= {});
        byHotel[h][n][f] = t; // 1 turno por día por persona
      }

      let html = '';
      for (const [h, byEmp] of Object.entries(byHotel)){
        html += `
          <div class="row-card">
            <table class="grid-week">
              <thead>
                <tr>
                  <th style="min-width:180px">${h}</th>
                  ${fechasOrden.map(f=>`<th>${diaNombre(f)}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${Object.keys(byEmp).sort().map(emp => `
                  <tr>
                    <td><strong>${emp}</strong></td>
                    ${fechasOrden.map(f => `<td>${pill(byEmp[emp][f])}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`;
      }

      app.innerHTML = html;
    };
  }

  // ====== INIT ======
  async function init(){
    await whenReady();
    ensureRender();

    // Controles
    const sh = $('#hotelSelect');
    const se = $('#employeeFilter');
    const df = $('#dateFrom');
    const dt = $('#dateTo');

    // Flatpickr
    try { if (window.flatpickr?.l10ns?.es) flatpickr.localize(flatpickr.l10ns.es); } catch {}
    const fpFrom = flatpickr(df, { dateFormat:'d/M/Y', weekNumbers:true, defaultDate: df.value || undefined });
    const fpTo   = flatpickr(dt, { dateFormat:'d/M/Y', weekNumbers:true, defaultDate: dt.value || undefined });

    // Poblar selects
    const D = getData();
    const H = hotelsFrom(D);
    sh.innerHTML = '<option value="">— Hotel —</option>' + H.map(h=>`<option value="${h}">${h}</option>`).join('');
    const fillEmp = () => {
      const list = employeesFrom(D, sh.value || '');
      se.innerHTML = '<option value="">— Empleado —</option>' + list.map(n=>`<option value="${n}">${n}</option>`).join('');
    };
    sh.addEventListener('change', fillEmp); fillEmp();

    // Drawer
    $('#btnFilters')?.addEventListener('click', () => $('#filtersDrawer')?.classList.remove('hidden'));
    $('#btnCloseFilters')?.addEventListener('click', () => $('#filtersDrawer')?.classList.add('hidden'));
    $('.backdrop')?.addEventListener('click', () => $('#filtersDrawer')?.classList.add('hidden'));

    // Aplicar
    const apply = () => {
      const from = fpFrom.selectedDates?.[0] || null;
      const to   = fpTo.selectedDates?.[0]   || null;
      const hotel = sh.value || '';
      const emp   = se.value || '';
      window.renderContent({ dateFrom: from, dateTo: to, hotel, employee: emp });
    };
    $('#btnApply')?.addEventListener('click', () => { apply(); $('#filtersDrawer')?.classList.add('hidden'); });

    // Navegación arriba
    const shiftDays = (days) => {
      const f = fpFrom.selectedDates?.[0] || new Date();
      const t = fpTo.selectedDates?.[0]   || new Date(f.getTime()+6*MS);
      fpFrom.setDate(new Date(f.getTime()+days*MS), true);
      fpTo.setDate(  new Date(t.getTime()+days*MS), true);
      apply();
    };
    $('#btnPrevTop') ?.addEventListener('click', () => shiftDays(-7));
    $('#btnTodayTop')?.addEventListener('click', () => { const n=new Date(); fpFrom.setDate(n,true); fpTo.setDate(new Date(n.getTime()+6*MS), true); apply(); });
    $('#btnNextTop') ?.addEventListener('click', () => shiftDays(+7));

    // Primer render
    apply();
  }

  init().catch(e => {
    console.warn('[APP] No se pudo iniciar la vista móvil:', e);
    $('#app').innerHTML = `<p class="meta">No se pudo iniciar la APP: ${e.message}</p>`;
  });
})();
