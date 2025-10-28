// APP – Botón Filtros, botón Aplicar, refresh fiable y flatpickr garantizado
(function () {
  const $  = (s, r=document) => r.querySelector(s);

  function ensureFlatpickr(){
    const opts = { locale: 'es', dateFormat: 'Y-m-d', allowInput: true, weekNumbers: true };
    if (window.flatpickr){
      if (!$('#dateFrom')?._flatpickr) window.flatpickr('#dateFrom', opts);
      if (!$('#dateTo')?._flatpickr)   window.flatpickr('#dateTo',   opts);
    }
  }

  function triggerRefresh(){
    ['hotelSelect','employeeFilter','dateFrom','dateTo'].forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      ['input','change'].forEach(ev=> el.dispatchEvent(new Event(ev, {bubbles:true})));
    });
  }

  function initUI(){
    const bar = $('.controls-container');
    const btn = $('#btnFilters');
    const apply = $('#btnApply');
    if (!bar || !btn || !apply) return;

    btn.addEventListener('click', ()=>{
      const visible = getComputedStyle(bar).display !== 'none';
      if (visible){ bar.style.opacity='0'; setTimeout(()=>{ bar.style.display='none'; }, 200); }
      else { bar.style.display='flex'; bar.style.opacity='1'; ensureFlatpickr(); }
    });

    apply.addEventListener('click', ()=>{ ensureFlatpickr(); triggerRefresh(); });

    // refresco al cambiar fechas manualmente
    ['dateFrom','dateTo'].forEach(id=>{
      const el = document.getElementById(id);
      if(el){ el.addEventListener('change', triggerRefresh); el.addEventListener('input', triggerRefresh); }
    });

    // ocultar ICS siempre en APP
    ['#employeeSelectIcs','#btnICS'].forEach(sel=>{
      const el=$(sel); if(el){ el.style.display='none'; const p=el.closest('.field'); if(p)p.style.display='none'; }
    });

    // primera carga: mostrar controles
    bar.style.display='flex';
    bar.style.opacity='1';
    ensureFlatpickr();
  }

  function init(){
    if (!document.getElementById('app')) return;
    initUI();
    new MutationObserver(()=>initUI()).observe(document.body,{childList:true,subtree:true});
  }

  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
// === Mobile PATCH: filtros y fechas ===
(function () {
  const $ = s => document.querySelector(s);

  // Estado simple
  const state = {
    from: null,
    to: null
  };

  // Inicializar flatpickr (ES, lunes como primero)
  const fpFrom = flatpickr('#dateFrom', {
    locale: 'es',
    dateFormat: 'd/M/Y',
    weekNumbers: true,
    defaultDate: $('#dateFrom')?.value || undefined
  });
  const fpTo = flatpickr('#dateTo', {
    locale: 'es',
    dateFormat: 'd/M/Y',
    weekNumbers: true,
    defaultDate: $('#dateTo')?.value || undefined
  });

  // Botón “Aplicar”: lee fechas y renderiza
  function applyFilters() {
    state.from = fpFrom.selectedDates?.[0] || null;
    state.to   = fpTo.selectedDates?.[0]   || null;

    // Si falta alguna, usa la otra como referencia (+/- 31d)
    if (state.from && !state.to)   state.to   = new Date(state.from.getTime() + 31*864e5);
    if (!state.from && state.to)   state.from = new Date(state.to.getTime()   - 31*864e5);

    // Vuelca a inputs con el formato visible
    if (state.from) $('#dateFrom').value = fpFrom.formatDate(state.from, 'd/M/Y');
    if (state.to)   $('#dateTo').value   = fpTo.formatDate(state.to,   'd/M/Y');

    // NOTA: la función de render viene del adaptador
    if (typeof window.renderContent === 'function') {
      window.renderContent({
        dateFrom: state.from,
        dateTo: state.to,
        hotel: $('#hotelSelect')?.value || '',
        employee: $('#employeeFilter')?.value || ''
      });
    }
  }

  // Enlaza botón “Aplicar”
  $('#btnApply')?.addEventListener('click', applyFilters);

  // Prev/Hoy/Next semana
  $('#btnPrevW')?.addEventListener('click', () => {
    fpFrom.setDate(new Date(fpFrom.selectedDates[0].getTime() - 7*864e5), true);
    fpTo.setDate(  new Date(fpTo.selectedDates[0].getTime()   - 7*864e5), true);
    applyFilters();
  });
  $('#btnTodayW')?.addEventListener('click', () => {
    const now = new Date();
    fpFrom.setDate(now, true);
    fpTo.setDate(new Date(now.getTime() + 30*864e5), true);
    applyFilters();
  });
  $('#btnNextW')?.addEventListener('click', () => {
    fpFrom.setDate(new Date(fpFrom.selectedDates[0].getTime() + 7*864e5), true);
    fpTo.setDate(  new Date(fpTo.selectedDates[0].getTime()   + 7*864e5), true);
    applyFilters();
  });

  // Al abrir: primer render con lo que haya en los inputs
  applyFilters();
})();

