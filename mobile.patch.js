// APP (móvil) – Controles desplegables + refresco fiable
(function () {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  function triggerRefresh(){
    // Dispara los listeners que ya pone plantilla_adapter_semana.js
    ['hotelSelect','employeeFilter','dateFrom','dateTo'].forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      ['input','change'].forEach(ev=> el.dispatchEvent(new Event(ev, {bubbles:true})));
    });
  }

  function ensureApplyButton(){
    // Crea/inyecta un botón "Aplicar" dentro de la barra de controles
    const bar = $('.controls-container');
    if (!bar || $('#btnApply')) return;
    const box = document.createElement('div');
    box.className = 'field';
    box.innerHTML = `<button class="btn" id="btnApply" type="button">Aplicar</button>`;
    bar.appendChild(box);
    $('#btnApply').addEventListener('click', triggerRefresh);
  }

  function addHeaderFiltersButton(){
    const header = $('header');
    if (!header || $('#btnFilters')) return;

    const btn = document.createElement('button');
    btn.id = 'btnFilters';
    btn.className = 'btn';
    btn.type = 'button';
    btn.textContent = 'Filtros';
    // Lo metemos al final del header, antes de la barra
    header.insertBefore(btn, $('.controls-container')?.nextSibling || null);

    let autoHide;
    const show = () => {
      const bar = $('.controls-container');
      if(!bar) return;
      bar.style.display = 'flex';
      bar.style.opacity = '1';
      clearTimeout(autoHide);
      autoHide = setTimeout(hide, 8000); // se oculta solo tras 8s sin tocar
    };
    const hide = () => {
      const bar = $('.controls-container');
      if(!bar) return;
      bar.style.opacity = '0';
      setTimeout(()=>{ bar.style.display='none'; }, 300);
    };

    btn.addEventListener('click', show);
    // Si tocas algo dentro de los controles, prolonga la visibilidad y refresca
    $('.controls-container')?.addEventListener('change', ()=>{ show(); triggerRefresh(); });
    $('.controls-container')?.addEventListener('input',  ()=>{ show(); });

    // Primera carga: se muestra y luego se auto-oculta
    show();
  }

  function hideIcsForever(){
    // Oculta exportación ICS SIEMPRE en APP
    ['#employeeSelectIcs','#btnICS'].forEach(sel=>{
      const el=$(sel); if(el){ el.style.display='none'; const p=el.closest('.field'); if(p)p.style.display='none'; }
    });
    $$('label').forEach(el=>{
      const t=(el.textContent||'').toLowerCase();
      if (t.includes('exportar horario')) el.style.display='none';
    });
  }

  function init(){
    const appReady = !!document.getElementById('app');
    if (!appReady) return;
    hideIcsForever();
    addHeaderFiltersButton();
    ensureApplyButton();

    // Parche extra: cuando flatpickr cambie, forzamos refresh
    ['dateFrom','dateTo'].forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      el.addEventListener('change', triggerRefresh);
      el.addEventListener('input',  triggerRefresh);
    });

    // Si el DOM cambia (tras pintar semanas), reocultar ICS y mantener botón
    const mo = new MutationObserver(()=>{ hideIcsForever(); ensureApplyButton(); });
    mo.observe(document.body, {childList:true, subtree:true});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
