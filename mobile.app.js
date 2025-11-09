/* mobile.app.js — Boot móvil con recarga anti-caché del data.js */
(function(){
  'use strict';

  const toISO = (d)=>{ const dt = d instanceof Date ? d : new Date(d);
    const z = new Date(dt.getTime()-dt.getTimezoneOffset()*60000); return z.toISOString().slice(0,10); };
  const mondayOf = (any)=>{ const base = any ? new Date(any) : new Date();
    const wd=(base.getDay()+6)%7; const m=new Date(base); m.setDate(base.getDate()-wd); return toISO(m); };

  function currentMondayFromHash(){
    const h = (location.hash||'').replace('#','').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(h) ? h : mondayOf(new Date());
  }

  function populateFilters(hotelsAll, monday){
    const sel = document.getElementById('f-hotel');
    const inp = document.getElementById('f-week');
    if (sel) {
      sel.innerHTML = '<option value="*">— Todos —</option>' +
        (hotelsAll||[]).map(h=>`<option value="${h.id}">${h.nombre||h.id}</option>`).join('');
      if (!sel.value) sel.value='*';
    }
    if (inp) inp.value = monday;
  }

  function ensureContainer(){
    if(!document.getElementById('monthly-summary-container')){
      const box=document.createElement('div'); box.id='monthly-summary-container';
      (document.querySelector('main')||document.body).appendChild(box);
    }
  }

  // ---- Carga del data.js con cache-busting ----
  function reloadData(then){
    try{
      delete window.FULL_DATA;
      // elimina scripts previos
      [...document.querySelectorAll('script[data-live="data"]')].forEach(s=>s.remove());
      const ts = Date.now();
      const s1=document.createElement('script');
      s1.src=`data.js?v=20251109_1708&t=${ts}`;
      s1.async=false; s1.dataset.live='data';
      const s2=document.createElement('script');
      s2.src=`data.ausencias.js?v=20251109_1708&t=${ts}`;
      s2.async=false; s2.dataset.live='data';
      s2.onload=()=>{ then && then(); };
      document.body.appendChild(s1);
      document.body.appendChild(s2);
    }catch(e){ console.warn('reloadData error', e); then && then(); }
  }

  function renderWeek(monISO, hotel, doReload){
    const render = (window.MobileTemplate && window.MobileTemplate.renderContent) || window.renderContent;
    const afterData = ()=>{
      ensureContainer();
      try{
        const out = render(window.FULL_DATA, {hotel, dateFrom: monISO});
        const FD = (window.buildFD?window.buildFD(): (window.buildModel?window.buildModel():{})) || {};
        const monday = out && out.monday ? out.monday : monISO;
        const hotelsAll = out && out.hotelsAll ? out.hotelsAll : (FD.hoteles||[]);
        populateFilters(hotelsAll, monday);
        document.dispatchEvent(new CustomEvent('mobile:rendered', {detail:{hotel, monday}}));
      }catch(e){
        console.error('[mobile] error al renderizar', e);
      }
    };
    if (!render){ setTimeout(()=>renderWeek(monISO, hotel, doReload), 50); return; }
    doReload ? reloadData(afterData) : afterData();
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const btnPrev  = document.getElementById('btnPrev');
    const btnNext  = document.getElementById('btnNext');
    const btnToday = document.getElementById('btnToday');
    const btnFilters = document.getElementById('btnFilters');
    const btnReload = document.getElementById('btnReload');
    const drawer   = document.getElementById('drawer');
    const fCancel  = document.getElementById('f-cancel');
    const fApply   = document.getElementById('f-apply');
    const fHotel   = document.getElementById('f-hotel');
    const fWeek    = document.getElementById('f-week');

    let monday = currentMondayFromHash();
    let hotel  = '*'; // por defecto: ambos hoteles

    const openDrawer = ()=> drawer && (drawer.style.transform='translateY(0)', drawer.setAttribute('aria-hidden','false'));
    const closeDrawer = ()=> drawer && (drawer.style.transform='translateY(100%)', drawer.setAttribute('aria-hidden','true'));

    const safeRender = (reload=false)=>{ const r=(window.MobileTemplate&&window.MobileTemplate.renderContent)||window.renderContent;
      if (!r){ setTimeout(()=>safeRender(reload), 60); return; }
      renderWeek(monday, hotel, reload);
    };

    const shift = (days)=>{ const d=new Date(monday); d.setDate(d.getDate()+days); monday = toISO(d); location.hash=monday; renderWeek(monday, hotel, true); };
    btnPrev  && btnPrev.addEventListener('click', ()=>shift(-7));
    btnNext  && btnNext.addEventListener('click', ()=>shift(+7));
    btnToday && btnToday.addEventListener('click', ()=>{ monday = mondayOf(new Date()); location.hash=monday; renderWeek(monday, hotel, true); });

    btnReload && btnReload.addEventListener('click', ()=> renderWeek(monday, hotel, true));

    btnFilters && btnFilters.addEventListener('click', openDrawer);
    fCancel && fCancel.addEventListener('click', closeDrawer);
    fApply && fApply.addEventListener('click', ()=>{
      hotel  = (fHotel && fHotel.value) || hotel;
      const v = (fWeek && fWeek.value)||'';
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) monday = v;
      location.hash=monday;
      closeDrawer();
      renderWeek(monday, hotel, true);
    });

    window.addEventListener('hashchange', ()=>{ monday = currentMondayFromHash(); renderWeek(monday, hotel, true); });

    setTimeout(()=>safeRender(true), 80); // primer render recargando datos
  });
})();
