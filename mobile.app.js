/* mobile.app.js — Boot móvil sin depender de selects; muestra TODOS los hoteles */
(function(){
  'use strict';

  const DAY = 86400000;
  const toISO = d => {
    const dt = d instanceof Date ? d : new Date(d);
    const z = new Date(dt.getTime() - dt.getTimezoneOffset()*60000);
    return z.toISOString().slice(0,10);
  };
  const mondayOf = any => {
    const base = any instanceof Date ? any : new Date(any||Date.now());
    const wd = (base.getDay()+6)%7;
    const m = new Date(base); m.setDate(base.getDate()-wd);
    return toISO(m);
  };
  const addDays = (iso, n) => {
    const t = new Date(iso).getTime();
    return toISO(new Date(t + n*DAY));
  };

  function ensureContainer(){
    if(!document.getElementById('monthly-summary-container')){
      const box=document.createElement('div'); box.id='monthly-summary-container';
      (document.querySelector('main')||document.body).appendChild(box);
    }
  }

  function renderWeek(monISO){
    if(!window.FULL_DATA){ console.error('[mobile] Falta data.js'); return; }
    if(typeof window.renderContent!=='function'){ console.error('[mobile] Falta plantilla_mobile_adapter.js'); return; }

    ensureContainer();

    // Mostrar TODOS los hoteles
    const opts = { hotel: '', employee:'', dateFrom: monISO, dateTo: addDays(monISO,6) };
    try{
      window.renderContent(window.FULL_DATA, opts);
      document.dispatchEvent(new CustomEvent('mobile:rendered', {detail:opts}));
    }catch(e){
      console.error('[mobile] error al renderizar', e);
    }
  }

  // navegación básica
  function currentMondayFromHash(){
    const h = (location.hash||'').replace('#','').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(h) ? h : mondayOf(new Date());
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    // botones semana ← → hoy
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const btnToday= document.getElementById('btnToday');

    let monday = currentMondayFromHash();
    renderWeek(monday);

    const shift = (d)=>{ monday = toISO(new Date(new Date(monday).getTime()+d*DAY)); renderWeek(monday); location.hash = monday; };
    btnPrev && btnPrev.addEventListener('click', ()=> shift(-7));
    btnNext && btnNext.addEventListener('click', ()=> shift(+7));
    btnToday&& btnToday.addEventListener('click', ()=>{ monday = mondayOf(new Date()); renderWeek(monday); location.hash = monday; });

    window.addEventListener('hashchange', ()=>{ monday = currentMondayFromHash(); renderWeek(monday); });
  });
})();
