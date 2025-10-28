/* mobile.patch.js — APP móvil con:
   - Aplanado de FULL_DATA.schedule[].turnos → filas planas (hotel, empleado, fecha, turno)
   - Filtros robustos (si no hay fechas, no se filtra por fecha; si solo hay "desde", asume 7 días)
   - Navegación arriba (← Semana · Hoy · Semana →)
   - Fallback garantizado (si el adaptador no define window.renderContent, la app no se cae)
*/
(function () {
  const $ = s => document.querySelector(s);
  const unique = a => [...new Set(a.filter(Boolean))];
  const MS = 864e5;

  // ------------------------------------------------------------
  // Fallback mínimo (garantiza que siempre existe renderContent)
  // ------------------------------------------------------------
  function minimalFallback(msg) {
    const el = document.getElementById('app');
    if (!el) return;
    el.innerHTML = `<p class="meta">${msg || 'Listo. Abre <b>Filtros</b>, elige Hotel/Rango y pulsa <b>Aplicar</b>.'}</p>`;
  }
  if (typeof window.renderContent !== 'function') {
    window.renderContent = function () { minimalFallback(); };
  }

  // ---------------------
  // Lectura / normalizado
  // ---------------------
  const getData = () => window.FULL_DATA || {};

  // Convierte la estructura semanal en filas planas
  function flattenRows(D) {
    const S = Array.isArray(D.schedule) ? D.schedule : [];
    if (!S.length) return Array.isArray(D.data) ? D.data : [];

    // Si es semanal (tiene "turnos")
    if (S[0] && Array.isArray(S[0].turnos)) {
      const out = [];
      for (const w of S) {
        const hotel = w.hotel || w.Hotel || w.establecimiento || w?.meta?.hotel || "";
        for (const t of (w.turnos || [])) {
          out.push({
            hotel,
            empleado: t.empleado || t.employee || t.nombre || t.name || t.persona || "",
            fecha:    t.fecha    || t.date    || t.dia   || t.day   || t?.meta?.fecha || "",
            turno:    t.turno    || t.shift   || t.tramo || t?.meta?.turno || ""
          });
        }
      }
      return out;
    }

    // Ya plano
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
    // Si el objeto trae employees estructurados, preferirlos
    if (Array.isArray(D.employees) && D.employees.length) {
      return hotel
        ? D.employees.filter(e => (e.hotel || e.Hotel) === hotel).map(e => e.name || e.empleado || e)
        : D.employees.map(e => e.name || e.empleado || e);
    }
    // Deducción de datos
    return unique(flattenRows(D)
      .filter(x => !hotel || hotelOf(x) === hotel)
      .map(nameOf));
  };

  // ---------------------------
  // Espera a DOM + datos reales
  // ---------------------------
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

  // -----------------------------------------
  // Fallback de render (tabla semanal compacta)
  // -----------------------------------------
  function ensureRender(){
    if (typeof window.renderContent === 'function'
        && window.renderContent !== minimalFallback /* por si quedó el mínimo */) return;

    const diaNombre = d => {
      try { return new Date(d).toLocaleDateString('es-ES',{weekday:'short', day:'2-digit'}); }
      catch { return d || ''; }
    };
    const pill = t => {
      const s = String(t||'').toLowerCase();
      if (s.includes('mañana') || s.includes('manana')) return `<span class="pill pill-m">Mañana</span>`;
      if (s.includes('tarde'))  return `<span class="pill pill-t">Tarde</span>`;
      if (s.includes('noche'))  return `<span class="pill pill-n">Noche 🌙</span>`;
      if (s.includes('descanso')) return `<span class="pill pill-x">Descanso</span>`;
      return t ? `<span class="pill pill-ghost">${t}</span>` : '—';
    };

    window.renderContent = function renderContent({dateFrom, dateTo, hotel, employee} = {}){
      const rowsAll = flattenRows(getData());

      // Normalización fechas
      let from = dateFrom ? new Date(dateFrom) : null;
      let to   = dateTo   ? new Date(dateTo)   : null;
      if (from && !to) to = new Date(from.getTime() + 6 * MS); // si sólo hay "desde": 7 días

      // Filtro robusto
      const rows = rowsAll.filter(r => {
        if (hotel && hotelOf(r) !== hotel) return false;
        if (employee && nameOf(r) !== employee) return false;

        if (from || to) {
          const dStr = dateOf(r);
          const dObj = dStr ? new Date(dStr) : null; // ISO → Date OK
          if (dObj && from && dObj < from) return false;
          if (dObj && to   && dObj > to  ) return false;
        }
        return true;
      });

      const app = $('#app');
      if (!rows.length){
        app.innerHTML = `<p class="meta">No hay datos para mostrar con los filtros seleccionados.</p>`;
        return;
      }

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
        byHotel[h][n][f] = t;
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

  // ------------
  // Inicialización
  // ------------
  async function init(){
    try { await whenReady(); } catch(e) { /* seguimos con fallback */ }

    // Aseguramos fallback si el adaptador no definió nada
    ensureRender();

    // Controles
    const sh = $('#hotelSelect');
    const se = $('#employeeFilter');
    const df = $('#dateFrom');
    const dt = $('#dateTo');

    // Flatpickr (si está cargado en HTML)
    try { if (window.flatpickr?.l10ns?.es) flatpickr.localize(flatpickr.l10ns.es); } catch {}
    const fpFrom = window.flatpickr ? flatpickr(df, { dateFormat:'d/M/Y', weekNumbers:true, defaultDate: df?.value || undefined }) : null;
    const fpTo   = window.flatpickr ? flatpickr(dt, { dateFormat:'d/M/Y', weekNumbers:true, defaultDate: dt?.value || undefined }) : null;

    // Poblar selects
    const D = getData();
    const H = hotelsFrom(D);
    if (sh) sh.innerHTML = '<option value="">— Hotel —</option>' + H.map(h=>`<option value="${h}">${h}</option>`).join('');
    const fillEmp = () => {
      const list = employeesFrom(D, sh?.value || '');
      if (se) se.innerHTML = '<option value="">— Empleado —</option>' + list.map(n=>`<option value="${n}">${n}</option>`).join('');
    };
    sh?.addEventListener('change', fillEmp);
    fillEmp();

    // Drawer
    $('#btnFilters') ?.addEventListener('click', () => $('#filtersDrawer') ?.classList.remove('hidden'));
    $('#btnCloseFilters')?.addEventListener('click', () => $('#filtersDrawer') ?.classList.add('hidden'));
    $('.backdrop')     ?.addEventListener('click', () => $('#filtersDrawer') ?.classList.add('hidden'));

    // Aplicar
    const apply = () => {
      const from = fpFrom?.selectedDates?.[0] || null;
      const to   = fpTo  ?.selectedDates?.[0] || null;
      const hotel = sh?.value || '';
      const emp   = se?.value || '';
      try { window.renderContent({ dateFrom: from, dateTo: to, hotel, employee: emp }); }
      catch { minimalFallback('No se pudo pintar la vista.'); }
    };
    $('#btnApply')?.addEventListener('click', () => { apply(); $('#filtersDrawer')?.classList.add('hidden'); });

    // Navegación arriba
    const shiftDays = (days) => {
      const f = fpFrom?.selectedDates?.[0] || new Date();
      const t = fpTo  ?.selectedDates?.[0] || new Date(f.getTime()+6*MS);
      fpFrom?.setDate(new Date(f.getTime()+days*MS), true);
      fpTo  ?.setDate(new Date(t.getTime()+days*MS), true);
      apply();
    };
    $('#btnPrevTop') ?.addEventListener('click', () => shiftDays(-7));
    $('#btnTodayTop')?.addEventListener('click', () => {
      const n=new Date();
      fpFrom?.setDate(n,true);
      fpTo  ?.setDate(new Date(n.getTime()+6*MS), true);
      apply();
    });
    $('#btnNextTop') ?.addEventListener('click', () => shiftDays(+7));

    // Primer render inofensivo
    try { window.renderContent({}); } catch (e) { minimalFallback('No se pudo iniciar la APP: ' + e.message); }
  }

  init().catch(e => minimalFallback('No se pudo iniciar la APP: ' + e.message));
})();
