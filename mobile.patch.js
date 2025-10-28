// mobile.patch.js — init robusto para APP
(function () {
  const $ = s => document.querySelector(s);
  const unique = a => [...new Set(a.filter(Boolean))];

  // Detecta hoteles y empleados desde FULL_DATA
  const hotelsFrom = D => {
    if (Array.isArray(D.hotels) && D.hotels.length) return unique(D.hotels);
    const S = D.schedule || D.data || [];
    const H = unique(S.map(x => x.hotel || x.Hotel || x.establecimiento || x?.meta?.hotel));
    return H.length ? H : ["Sercotel Guadiana","Cumbria Spa&Hotel"];
  };
  const employeesFrom = (D, hotel) => {
    const S = D.schedule || D.data || [];
    return unique(
      S.filter(x => !hotel || (x.hotel||x.Hotel||x.establecimiento||x?.meta?.hotel) === hotel)
       .map(x => x.empleado || x.employee || x.nombre || x.name || x.persona)
    );
  };

  // Espera DOM + datos
  function whenReady(maxMs = 8000){
    return new Promise((resolve, reject) => {
      const t0 = performance.now();
      const iv = setInterval(() => {
        const domOK = document.readyState === 'complete' || document.readyState === 'interactive';
        const D = window.FULL_DATA;
        const dataOK = D && ((D.schedule?.length ?? 0) > 0 || (D.data?.length ?? 0) > 0);
        if (domOK && dataOK) { clearInterval(iv); resolve(); }
        else if (performance.now() - t0 > maxMs) { clearInterval(iv); reject(new Error('timeout: FULL_DATA o DOM no disponibles')); }
      }, 100);
    });
  }

  // Fallback muy simple para ver contenido si el adaptador no define renderContent
  function ensureRender(){
    if (typeof window.renderContent === 'function') return;
    window.renderContent = ({dateFrom, dateTo, hotel, employee} = {}) => {
      const D = window.FULL_DATA || {};
      const S = (D.schedule || D.data || []).filter(r => {
        const hOK = !hotel || (r.hotel||r.Hotel||r.establecimiento||r?.meta?.hotel) === hotel;
        const eOK = !employee || (r.empleado||r.employee||r.nombre||r.name||r.persona) === employee;
        return hOK && eOK;
      });
      const el = $('#app');
      if (!S.length) { el.innerHTML = '<p>No hay datos para mostrar.</p>'; return; }
      // Render mínimo (lista plana)
      el.innerHTML = `
        <div class="mini-list">
          ${S.map(it => `
            <div class="mini-row">
              <strong>${it.empleado||it.nombre||it.name||'—'}</strong>
              <span> · ${it.dia || it.fecha || it.date || ''}</span>
              <span> · ${it.turno || it.shift || ''}</span>
              <span> · ${it.hotel||it.Hotel||it.establecimiento||''}</span>
            </div>`).join('')}
        </div>`;
    };
  }

  async function init(){
    await whenReady();
    ensureRender();

    // Controles del drawer
    const sh = $('#filtersDrawer #hotelSelect');
    const se = $('#filtersDrawer #employeeFilter');
    const df = $('#filtersDrawer #dateFrom');
    const dt = $('#filtersDrawer #dateTo');

    // Flatpickr
    try { if (window.flatpickr?.l10ns?.es) flatpickr.localize(flatpickr.l10ns.es); } catch {}
    const fpFrom = flatpickr(df, { dateFormat:'d/M/Y', weekNumbers:true, defaultDate: df.value || undefined });
    const fpTo   = flatpickr(dt, { dateFormat:'d/M/Y', weekNumbers:true, defaultDate: dt.value || undefined });

    // Poblar selects
    const D = window.FULL_DATA || {};
    const H = hotelsFrom(D);
    sh.innerHTML = '<option value="">— Hotel —</option>' + H.map(h=>`<option value="${h}">${h}</option>`).join('');
    const fillEmp = () => {
      const list = employeesFrom(D, sh.value || '');
      se.innerHTML = '<option value="">— Empleado —</option>' + list.map(n=>`<option value="${n}">${n}</option>`).join('');
    };
    sh.addEventListener('change', fillEmp); fillEmp();

    // Abrir / cerrar drawer
    $('#btnFilters')?.addEventListener('click', () => $('#filtersDrawer')?.classList.remove('hidden'));
    $('#btnCloseFilters')?.addEventListener('click', () => $('#filtersDrawer')?.classList.add('hidden'));
    $('.backdrop')?.addEventListener('click', () => $('#filtersDrawer')?.classList.add('hidden'));

    // Aplicar + navegación de semana
    const apply = () => {
      const from = fpFrom.selectedDates?.[0] || null;
      const to   = fpTo.selectedDates?.[0]   || null;
      const hotel = sh.value || '';
      const emp   = se.value || '';
      window.renderContent({ dateFrom: from, dateTo: to, hotel, employee: emp });
    };
    $('#btnApply')?.addEventListener('click', () => { apply(); $('#filtersDrawer')?.classList.add('hidden'); });
    $('#btnPrevW')?.addEventListener('click', () => { if(!fpFrom||!fpTo) return; const f=fpFrom.selectedDates?.[0]||new Date(); const t=fpTo.selectedDates?.[0]||new Date(f.getTime()+30*864e5); fpFrom.setDate(new Date(f.getTime()-7*864e5), true); fpTo.setDate(new Date(t.getTime()-7*864e5), true); apply(); });
    $('#btnTodayW')?.addEventListener('click', () => { if(!fpFrom||!fpTo) return; const n=new Date(); fpFrom.setDate(n,true); fpTo.setDate(new Date(n.getTime()+30*864e5), true); apply(); });
    $('#btnNextW')?.addEventListener('click', () => { if(!fpFrom||!fpTo) return; const f=fpFrom.selectedDates?.[0]||new Date(); const t=fpTo.selectedDates?.[0]||new Date(f.getTime()+30*864e5); fpFrom.setDate(new Date(f.getTime()+7*864e5), true); fpTo.setDate(new Date(t.getTime()+7*864e5), true); apply(); });

    // Primer render
    apply();
  }

  init().catch(e => console.warn('[APP] No se pudo iniciar la vista móvil:', e));
})();
