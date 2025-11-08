/* mobile.app.js — Boot móvil con navegación y Filtros */
(function(){
  'use strict';

  const DAY = 86400000;
  const toISO = (d)=>{ const dt = d instanceof Date ? d : new Date(d); const z=new Date(dt.getTime()-dt.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };
  const mondayOf = (any)=>{ const base = any ? new Date(any) : new Date(); const wd=(base.getDay()+6)%7; const m=new Date(base); m.setDate(base.getDate()-wd); return toISO(m); };
  const addDays = (iso,n)=>{ const t=new Date(iso).getTime(); return toISO(new Date(t+n*DAY)); };

  function ensureContainer(){
    if(!document.getElementById('monthly-summary-container')){
      const box=document.createElement('div'); box.id='monthly-summary-container';
      (document.querySelector('main')||document.body).appendChild(box);
    }
  }

  function populateFilters(hotels, monday){
    const sel = document.getElementById('f-hotel');
    const inp = document.getElementById('f-week');
    sel.innerHTML = `<option value="">(Todos)</option>` + hotels.map(h=>`<option>${h}</option>`).join('');
    inp.value = monday;
  }

  function renderWeek(monISO, hotel=''){
    if(!window.FULL_DATA){ console.error('[mobile] Falta data.js'); return; }
    const render = (window.MobileTemplate && window.MobileTemplate.renderContent) || window.renderContent;
    if(!render){ console.error('[mobile] Falta plantilla_mobile_adapter.js'); return; }

    ensureContainer();

    try{
      const {monday, hotelsAll} = render(window.FULL_DATA, {hotel, dateFrom: monISO});
      // actualizar filtros
      populateFilters(hotelsAll, monday);
      // evento hook
      document.dispatchEvent(new CustomEvent('mobile:rendered', {detail:{hotel, monday}}));
    }catch(e){
      console.error('[mobile] error al renderizar', e);
    }
  }

  function currentMondayFromHash(){
    const h = (location.hash||'').replace('#','').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(h) ? h : mondayOf(new Date());
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    // Espera breve por si el adaptador define MobileTemplate/renderContent con retraso
    let readyTries = 0;
    const waitForAdapter = (cb)=>{
      const render = (window.MobileTemplate && window.MobileTemplate.renderContent) || window.renderContent;
      if (render || readyTries>20) return cb();
      readyTries++; setTimeout(()=>waitForAdapter(cb), 50);
    };
    const btnPrev  = document.getElementById('btnPrev');
    const btnNext  = document.getElementById('btnNext');
    const btnToday = document.getElementById('btnToday');
    const btnFilters = document.getElementById('btnFilters');
    const drawer   = document.getElementById('drawer');
    const fCancel  = document.getElementById('f-cancel');
    const fApply   = document.getElementById('f-apply');
    const fHotel   = document.getElementById('f-hotel');
    const fWeek    = document.getElementById('f-week');

    let monday = currentMondayFromHash();
    let hotel  = '';

    const shift = (d)=>{ monday = toISO(new Date(new Date(monday).getTime()+d*DAY)); location.hash = monday; renderWeek(monday, hotel); };

    // navegación
    btnPrev  && btnPrev.addEventListener('click', ()=> shift(-7));
    btnNext  && btnNext.addEventListener('click', ()=> shift( 7));
    btnToday && btnToday.addEventListener('click', ()=>{ monday = mondayOf(new Date()); location.hash = monday; renderWeek(monday, hotel); });

    // filtros
    btnFilters && btnFilters.addEventListener('click', ()=> drawer.classList.add('open'));
    fCancel    && fCancel.addEventListener('click', ()=> drawer.classList.remove('open'));
    fApply     && fApply.addEventListener('click', ()=>{
      hotel  = (fHotel.value||'').trim();
      monday = (fWeek.value && /^\d{4}-\d{2}-\d{2}$/.test(fWeek.value)) ? fWeek.value : monday;
      location.hash = monday;
      drawer.classList.remove('open');
      renderWeek(monday, hotel);
    });

    // hash navigation
    window.addEventListener('hashchange', ()=>{ monday = currentMondayFromHash(); renderWeek(monday, hotel); });

    // primer render
    renderWeek(monday, hotel);
  });
})();
