
// --- Turnos mobile v2 patch ---
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

  function init(){
    wrapScrollable();
    setTimeout(todayFocus, 150);
    const app = q('#app');
    if (app){
      const obs = new MutationObserver(()=>{
        if (!q('.scrollwrap')) wrapScrollable();
      });
      obs.observe(app, { childList:true, subtree:true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
// ===== Encoger encabezado y plegar filtros =====
(function(){
  const $ = (s, r=document)=>r.querySelector(s);

  function setupCompactHeader(){
    const header = $('header');
    if(!header) return;
    header.classList.add('compact');

    // Crear botón "Filtros" si no existe
    if (!$('#btnFilters')) {
      const btn = document.createElement('button');
      btn.id = 'btnFilters';
      btn.className = 'controls-toggle';
      btn.type = 'button';
      btn.textContent = 'Filtros';
      // Insertar al final del header (junto a los controles)
      header.appendChild(btn);

      // Restaurar estado previo (colapsado/abierto)
      const key = 'turnos_show_filters';
      if (localStorage.getItem(key) === '1') document.body.classList.add('show-controls');

      btn.addEventListener('click', ()=>{
        document.body.classList.toggle('show-controls');
        localStorage.setItem(key, document.body.classList.contains('show-controls') ? '1' : '0');
        // Recalcular sticky por si cambia la altura del header
        fixStickyTop();
      });
    }
    // Fijar altura real del header en la CSS var --header-top
    fixStickyTop();
  }

  function fixStickyTop(){
    const header = document.querySelector('header');
    if(!header) return;
    const h = Math.round(header.getBoundingClientRect().height);
    document.documentElement.style.setProperty('--header-top', h+'px');
  }

  // Correr al cargar y cuando cambie el layout
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', setupCompactHeader);
  } else {
    setupCompactHeader();
  }
  window.addEventListener('resize', fixStickyTop);
})();

