/* mobile.app.js — Boot móvil robusto */
(function(){
  'use strict';

  const DAY = 86400000;
  const toISO = (d)=>{ const dt = d instanceof Date ? d : new Date(d);
    const z = new Date(dt.getTime()-dt.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };
  const mondayOf = (any)=>{ const base = any ? new Date(any) : new Date();
    const wd=(base.getDay()+6)%7; const m=new Date(base); m.setDate(base.getDate()-wd); return toISO(m); };
  const addDays = (iso,n)=>{ const t=new Date(iso).getTime(); return toISO(new Date(t+n*DAY)); };

  function getFD(){
    let FD = window.FULL_DATA || window.DATA || window.SCHEDULE || {};
    if (!Array.isArray(FD.semanas)) {
      const candidates = [FD.semanas, FD.schedule, FD.data, FD.rows].filter(Array.isArray);
      if (candidates.length) FD.semanas = candidates[0];
    }
    if (!Array.isArray(FD.hoteles)) {
      const set = new Set();
      (FD.semanas||[]).forEach(s=> s&&s.hotel && set.add(String(s.hotel).trim()));
      FD.hoteles = [...set].map(h=>({id:h, nombre:h}));
    }
    return FD;
  }

  function populateFilters(hotelsAll, monday){
  const sel = document.getElementById('f-hotel');
  const inp = document.getElementById('f-week');
  if (sel) {
    sel.innerHTML = '<option value="*">— Todos —</option>' +
      (hotelsAll||[]).map(h=>`<option value="${h.id}">${h.nombre||h.id}</option>`).join('');
    if (!sel.value) sel.value = '*';   // por defecto, Todos
  }
  if (inp) inp.value = monday;
}





  function ensureContainer(){
    if(!document.getElementById('monthly-summary-container')){
      const box=document.createElement('div'); box.id='monthly-summary-container';
      (document.querySelector('main')||document.body).appendChild(box);
    }
  }

  function renderWeek(monISO, hotel){
    const render = (window.MobileTemplate && window.MobileTemplate.renderContent) || window.renderContent;
    if(!render){ console.error('[mobile] Falta plantilla_mobile_adapter.js'); return; }
    ensureContainer();
    try{
      const out = render(window.FULL_DATA, {hotel, dateFrom: monISO});
      // si el adaptador devuelve metadatos, úsalos; si no, deduce
      const FD = getFD();
      const monday = out && out.monday ? out.monday : monISO;
      const hotelsAll = out && out.hotelsAll ? out.hotelsAll : (FD.hoteles||[]);
      populateFilters(hotelsAll, monday);
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
let hotel  = '*';   // ← clave para pintar ambos al iniciar


    const safeRender = ()=>{
      const render = (window.MobileTemplate && window.MobileTemplate.renderContent) || window.renderContent;
      if (!render){ setTimeout(safeRender, 50); return; }
      renderWeek(monday, hotel);
    };

    // Nav
    btnPrev  && btnPrev.addEventListener('click', ()=>{ monday = toISO(new Date(new Date(monday).getTime()-7*DAY)); location.hash=monday; renderWeek(monday, hotel); });
    btnNext  && btnNext.addEventListener('click', ()=>{ monday = toISO(new Date(new Date(monday).getTime()+7*DAY)); location.hash=monday; renderWeek(monday, hotel); });
    btnToday && btnToday.addEventListener('click', ()=>{ monday = mondayOf(new Date()); location.hash=monday; renderWeek(monday, hotel); });

    // Drawer
    const openDrawer = ()=> drawer && (drawer.style.transform='translateY(0)', drawer.setAttribute('aria-hidden','false'));
    const closeDrawer = ()=> drawer && (drawer.style.transform='translateY(100%)', drawer.setAttribute('aria-hidden','true'));
    btnFilters && btnFilters.addEventListener('click', openDrawer);
    fCancel && fCancel.addEventListener('click', closeDrawer);
    fApply && fApply.addEventListener('click', ()=>{
      hotel  = (fHotel && fHotel.value) || hotel;
      const v = (fWeek && fWeek.value)||'';
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) monday = v;
      location.hash=monday;
      closeDrawer();
      renderWeek(monday, hotel);
    });

    // Hash navigation
    window.addEventListener('hashchange', ()=>{ monday = currentMondayFromHash(); renderWeek(monday, hotel); });

    // Primer render (espera a que carguen scripts con file://)
    setTimeout(safeRender, 60);
  });
})();
