// APP (móvil) – Botón Filtros, Aplicar, refresh fiable y flatpickr garantizado
(function () {
  const $  = (s, r=document) => r.querySelector(s);

  function ensureFlatpickr(){
    const opts = {
      locale: 'es',
      dateFormat: 'd/M/Y',
      allowInput: true,
      weekNumbers: true
    };
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

    // toggle filtros
    btn.addEventListener('click', ()=>{
      const visible = getComputedStyle(bar).display !== 'none';
      if (visible){ bar.style.opacity='0'; setTimeout(()=>{ bar.style.display='none'; }, 200); }
      else { bar.style.display='flex'; bar.style.opacity='1'; ensureFlatpickr(); }
    });

    // aplicar => refrescar pintado
    apply.addEventListener('click', ()=>{ ensureFlatpickr(); triggerRefresh(); });

    // refrescar al cambiar fechas manualmente
    ['dateFrom','dateTo'].forEach(id=>{
      const el = document.getElementById(id);
      if(el){ el.addEventListener('change', triggerRefresh); el.addEventListener('input', triggerRefresh); }
    });

    // ocultar ICS por si se inyecta dinámicamente
    ['#employeeSelectIcs','#btnICS'].forEach(sel=>{
      const el=$(sel); if(el){ el.style.display='none'; const p=el.closest('.field'); if(p)p.style.display='none'; }
    });

    // mostrar controles la primera vez (para que el usuario los localice)
    bar.style.display='flex';
    bar.style.opacity='1';
    ensureFlatpickr();
  }

  function init(){
    if (!document.getElementById('app')) return;
    initUI();
    // Reaplicar si la UI se re-renderiza
    new MutationObserver(()=>initUI()).observe(document.body,{childList:true,subtree:true});
  }

  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
