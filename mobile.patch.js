// Turnos Mobile Patch v10: scroll horizontal, foco en hoy y ocultación robusta de Exportar/ICS
(function(){
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

  function wrapScrollable(){
    const header = $('.week-header'), grid = $('.grid');
    if (!header || !grid) return;
    if (header.parentElement && header.parentElement.classList.contains('scrollwrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'scrollwrap';
    const parent = header.parentElement;
    parent.insertBefore(wrap, header);
    wrap.appendChild(header); wrap.appendChild(grid);
  }

  function focusToday(){
    const header = $('.week-header'), wrap = $('.scrollwrap');
    if (!header || !wrap) return;
    const cells = $$('.week-header .cell');
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
    if (!matchMedia('(max-width:640px)').matches) return;
    ['#employeeSelectIcs','#btnICS'].forEach(sel=>{
      const el=$(sel); if(el){ el.style.display='none'; const p=el.closest('.field'); if(p)p.style.display='none'; }
    });
    $$('label, button, select, div').forEach(el=>{
      const t=(el.textContent||'').toLowerCase();
      if (t.includes('exportar horario') || t.includes('descargar ics')){
        el.style.display='none'; const p=el.closest('.field'); if(p)p.style.display='none';
      }
    });
  }

  function init(){
    wrapScrollable(); hideIcs();
    setTimeout(()=>{ focusToday(); hideIcs(); }, 150);
    const app = $('#app');
    if (app){
      const mo = new MutationObserver(()=>{ wrapScrollable(); hideIcs(); });
      mo.observe(app, { childList:true, subtree:true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
