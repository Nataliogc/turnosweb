
// --- Turnos mobile patch ---
(function(){
  const q = (s, r=document)=>r.querySelector(s);
  const qa = (s, r=document)=>Array.from(r.querySelectorAll(s));

  function wrapScrollable(){
    const header = q('.week-header');
    const grid = q('.grid');
    if (!header || !grid) return;

    // evitar duplicados
    if (header.parentElement && header.parentElement.classList.contains('scrollwrap')) return;

    const app = q('#app') || document.body;
    const wrap = document.createElement('div');
    wrap.className = 'scrollwrap';
    const hint = document.createElement('div');
    hint.className = 'scrollhint';
    hint.textContent = 'Desliza horizontalmente para ver toda la semana →';

    // Inserta antes del header
    header.parentElement.insertBefore(hint, header);
    header.parentElement.insertBefore(wrap, header);
    wrap.appendChild(header);
    wrap.appendChild(grid);
  }

  function todayFocus(){
    // Resalta la columna del día actual y la sitúa a la vista
    const header = q('.week-header');
    if (!header) return;
    const cells = qa('.week-header .cell');
    // cells[0] es la celda vacía de nombres; el lunes suele ser cells[1]
    let todayIndex = -1;
    const today = new Date();
    const fmt = (d)=> d.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'});
    // Busca por texto de día (dd/mm)
    for (let i=1;i<cells.length;i++){
      if ((cells[i].textContent||'').includes(fmt(today))){ todayIndex = i; break; }
    }
    const wrap = q('.scrollwrap');
    if (wrap && todayIndex > 0){
      // Calcula posición aproximada sumando anchos de columnas
      const nameCol = cells[0].getBoundingClientRect().width;
      const dayCol = cells[1].getBoundingClientRect().width;
      wrap.scrollTo({ left: Math.max(0, nameCol + (todayIndex-1)*dayCol - dayCol), behavior:'smooth' });
    }
  }

  function init(){
    wrapScrollable();
    setTimeout(todayFocus, 100);
    // Reaplicar si la app vuelve a renderizar
    const app = q('#app');
    if (app){
      const obs = new MutationObserver(()=>{
        // Intento idempotente: reintentar si cambió la rejilla
        if (!q('.scrollwrap')) wrapScrollable();
      });
      obs.observe(app, { childList:true, subtree:true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
