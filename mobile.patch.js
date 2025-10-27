
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
