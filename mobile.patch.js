// Scroll horizontal + foco en hoy + refuerzo para ocultar Exportar/ICS si aparecen
(function(){
  const q = (s, r=document)=>r.querySelector(s);
  const qa = (s, r=document)=>Array.from(r.querySelectorAll(s));

  function wrapScrollable(){
    const header = q('.week-header'); const grid = q('.grid');
    if (!header || !grid) return;
    if (header.parentElement && header.parentElement.classList.contains('scrollwrap')) return;
    const wrap = document.querySelector('.scrollwrap') || document.createElement('div');
    wrap.className = 'scrollwrap';
    const parent = header.parentElement;
    parent.insertBefore(wrap, header);
    wrap.appendChild(header); wrap.appendChild(grid);
  }

  function todayFocus(){
    const header = q('.week-header'); const wrap = q('.scrollwrap');
    if (!header || !wrap) return;
    const cells = qa('.week-header .cell');
    let idx = -1; const today = new Date();
    const fmt = (d)=> d.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'});
    for (let i=1;i<cells.length;i++){
      if ((cells[i].textContent||'').includes(fmt(today))) { idx = i; break; }
    }
    if (idx>0){
      const nameW = cells[0].getBoundingClientRect().width;
      const dayW  = cells[1].getBoundingClientRect().width;
      wrap.scrollTo({ left: Math.max(0, nameW + (idx-1)*dayW - (dayW*0.8)), behavior:'smooth' });
    }
  }

  function hideIcs(){
    // por si el HTML que rellena añade nodos de export/ics
    document.querySelectorAll('label, button, select, div').forEach(el=>{
      const t = (el.textContent||'').toLowerCase();
      if (t.includes('exportar horario') || t.includes('descargar ics')) {
        el.style.display='none';
        const p = el.closest('.field'); if (p) p.style.display='none';
      }
    });
  }

  function init(){
    wrapScrollable(); hideIcs(); setTimeout(()=>{ todayFocus(); hideIcs(); }, 150);
    const app = q('#app');
    if (app){
      const obs = new MutationObserver(()=>{ wrapScrollable(); hideIcs(); });
      obs.observe(app, { childList:true, subtree:true });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
