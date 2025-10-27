// Turnos mobile v3: scroll + foco hoy + header compacto + botón Filtros + fix sticky
(function(){
  const q = (s, r=document)=>r.querySelector(s);
  const qa = (s, r=document)=>Array.from(r.querySelectorAll(s));

  function wrapScrollable(){
    const header = q('.week-header');
    const grid = q('.grid');
    if (!header || !grid) return;
    if (header.parentElement && header.parentElement.classList.contains('scrollwrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'scrollwrap';
    const hint = document.createElement('div');
    hint.className = 'scrollhint';
    hint.textContent = 'Desliza horizontalmente para ver toda la semana →';
    const parent = header.parentElement;
    parent.insertBefore(hint, header);
    parent.insertBefore(wrap, header);
    wrap.appendChild(header);
    wrap.appendChild(grid);
  }

  function todayFocus(){
    const header = q('.week-header');
    const wrap = q('.scrollwrap');
    if (!header || !wrap) return;
    const cells = qa('.week-header .cell');
    let todayIndex = -1;
    const today = new Date();
    const fmt = (d)=> d.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'});
    for (let i=1;i<cells.length;i++){
      if ((cells[i].textContent||'').includes(fmt(today))){ todayIndex = i; break; }
    }
    if (todayIndex>0){
      const nameCol = cells[0].getBoundingClientRect().width;
      const dayCol = cells[1].getBoundingClientRect().width;
      wrap.scrollTo({ left: Math.max(0, nameCol + (todayIndex-1)*dayCol - (dayCol*0.8)), behavior:'smooth' });
    }
  }

  function setupCompactHeader(){
    const header = q('header');
    if (!header) return;
    if (!q('#btnFilters')){
      const btn = document.createElement('button');
      btn.id = 'btnFilters';
      btn.className = 'controls-toggle';
      btn.type = 'button';
      btn.textContent = 'Filtros';
      header.appendChild(btn);
      const KEY = 'turnos_show_filters';
      if (localStorage.getItem(KEY)==='1') document.body.classList.add('show-controls');
      btn.addEventListener('click', ()=>{
        document.body.classList.toggle('show-controls');
        localStorage.setItem(KEY, document.body.classList.contains('show-controls') ? '1' : '0');
        fixStickyTop();
      });
    }
    fixStickyTop();
  }

  function fixStickyTop(){
    const h = Math.round((q('header')||{}).getBoundingClientRect?.().height || 40);
    document.documentElement.style.setProperty('--header-top', h+'px');
  }

  function init(){
    wrapScrollable();
    setupCompactHeader();
    setTimeout(todayFocus, 150);
    const app = q('#app');
    if (app){
      const obs = new MutationObserver(()=>{
        if (!q('.scrollwrap')) wrapScrollable();
      });
      obs.observe(app, { childList:true, subtree:true });
    }
    window.addEventListener('resize', fixStickyTop);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
// === Ocultar "Exportar horario..." y "Descargar ICS" SOLO en móvil (<=640px), por texto o ID ===
(function(){
  function hideIcsMobile(){
    if (window.matchMedia('(max-width: 640px)').matches) {
      // 1) Por ID (si existen)
      const byId = ['#employeeSelectIcs', '#btnICS'];
      byId.forEach(sel => { const el = document.querySelector(sel); if (el) el.style.display = 'none'; });

      // 2) Por texto del label / botón (independiente del ID/clase)
      document.querySelectorAll('label, button, select, div').forEach(el => {
        const t = (el.textContent || '').toLowerCase();
        if (t.includes('exportar horario') || t.includes('descargar ics')) {
          // Oculta el propio nodo y su contenedor inmediato si es un campo
          el.style.display = 'none';
          const parent = el.closest('.field');
          if (parent) parent.style.display = 'none';
        }
      });
    }
  }
  // Ejecuta al cargar y si algo vuelve a renderizar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideIcsMobile);
  } else {
    hideIcsMobile();
  }
  const mo = new MutationObserver(hideIcsMobile);
  mo.observe(document.documentElement, { childList:true, subtree:true });
})();

