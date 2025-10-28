// mobile.patch.js — APP con navegación arriba y fallback de render semanal
(function () {
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const unique = a => [...new Set(a.filter(Boolean))];

  // ====== helpers de datos ======
  const getData = () => window.FULL_DATA || {};
  const getRows = D => Array.isArray(D.schedule) ? D.schedule
                     : Array.isArray(D.data)     ? D.data
                     : [];
  const hotelOf = r => r.hotel || r.Hotel || r.establecimiento || r?.meta?.hotel || "";
  const nameOf  = r => r.empleado || r.employee || r.nombre || r.name || r.persona || "";
  const dateOf  = r => r.fecha || r.date || r.dia || r.day || r?.meta?.fecha || "";
  const turnoOf = r => r.turno || r.shift || r.tramo || r?.meta?.turno || "";

  const hotelsFrom = D => {
    if (Array.isArray(D.hotels) && D.hotels.length) return unique(D.hotels);
    return unique(getRows(D).map(hotelOf));
  };
  const employeesFrom = (D, hotel) =>
    unique(getRows(D)
      .filter(x => !hotel || hotelOf(x) === hotel)
      .map(nameOf));

  // ====== espera a datos + DOM ======
  function whenReady(maxMs = 8000){
    return new Promise((resolve, reject) => {
      const t0 = performance.now();
      const iv = setInterval(() => {
        const domOK = document.readyState === 'complete' || document.readyState === 'interactive';
        const D = getData();
        const dataOK = (getRows(D).length > 0) || (Array.isArray(D.hotels) && D.hotels.length);
        if (domOK && dataOK) { clearInterval(iv); resolve(); }
        else if (performance.now() - t0 > maxMs) { clearInterval(iv); reject(new Error('timeout FULL_DATA/DOM')); }
      }, 100);
    });
  }

  // ====== fallback de render semanal (si adapter no define renderContent) ======
  function ensureRender(){
    if (typeof window.renderContent === 'function') return;

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
      const D = getData();
      const rows = getRows(D).filter(r => {
        if (hotel && hotelOf(r) !== hotel) return false;
        if (employee && nameOf(r) !== employee) return false;
        const d = dateOf(r);
        if (dateFrom && d && new Date(d) < new Date(dateFrom)) return false;
        if (dateTo   && d && new Date(d) > new Date(dateTo))   return false;
        return true;
      });

      const app = $('#app');
      if (!rows.length){
        app.innerHTML = `<p class="meta">No hay datos para mostrar con los filtros seleccionados.</p>`;
        return;
      }

      // Agrupar por hotel → fecha → empleado (para una vista semanal compacta)
      const byHotel = {};
      for (const r of rows){
        const h = hotelOf(r) || '—';
        const d = dateOf(r)  || '—';
        const n = nameOf(r)  || '—';
        const t = turnoOf(r) || '';
        (byHotel[h] ??= {});
        (byHotel[h][d] ??= []);
        byHotel[h][d].push({ n, t });
      }

      const fechasOrden = unique(rows.map(dateOf)).sort((a,b)=>new Date(a)-new Date(b));

      let html = '';
      for (const [h, fechas] of Object.entries(byHotel)){
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
                ${employeesFrom(D, h).map(emp => `
                  <tr>
                    <td><strong>${emp || '—'}</strong></td>
                    ${fechasOrden.map(f => {
                      const cel = (fechas[f] || []).find(x => x.n === emp);
                      return `<td>${cel ? pill(cel.t) : ''}</td>`;
                    }).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
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
      const t = fpTo.selectedDates?.[0]   || new Date(f.getTime()+6*864e5);
      fpFrom.setDate(new Date(f.getTime()+days*864e5), true);
      fpTo.setDate(  new Date(t.getTime()+days*864e5), true);
      apply();
    };
    $('#btnPrevTop') ?.addEventListener('click', () => shiftDays(-7));
    $('#btnTodayTop')?.addEventListener('click', () => { const n=new Date(); fpFrom.setDate(n,true); fpTo.setDate(new Date(n.getTime()+6*864e5), true); apply(); });
    $('#btnNextTop') ?.addEventListener('click', () => shiftDays(+7));

    // Primer render
    apply();
  }

  init().catch(e => {
    console.warn('[APP] No se pudo iniciar la vista móvil:', e);
    $('#app').innerHTML = `<p class="meta">No se pudo iniciar la APP: ${e.message}</p>`;
  });
})();
