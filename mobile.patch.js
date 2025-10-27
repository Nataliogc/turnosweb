(function(){
  const $ = (s, r=document)=>r.querySelector(s);
  const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

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
    hideIcs();
    const app = $('#app');
    if (app){
      const mo = new MutationObserver(()=>{ hideIcs(); });
      mo.observe(app, { childList:true, subtree:true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
