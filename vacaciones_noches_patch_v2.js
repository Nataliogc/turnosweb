
// vacaciones_noches_patch_v2.js  (con rutas de CSV tolerantes)
(function(){
  function norm(s){
    return (s||'').toLowerCase().normalize('NFD').replace(/\p{Mn}/gu,'').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
  }
  function panel(){ let p=document.getElementById('vac-debug');
    if(!p){ p=document.createElement('div'); p.id='vac-debug'; p.style.cssText='position:fixed;right:10px;bottom:10px;background:#fff;border:1px solid #ddd;padding:8px 10px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.1);font:12px system-ui;z-index:2147483647;max-width:520px;white-space:pre-wrap;opacity:.95'; document.body.appendChild(p); }
    return p;
  }
  function log(msg){ const p=panel(); p.textContent=(p.textContent?p.textContent+'\n':'')+msg; console.log('[VacOverlay]', msg); }

  function parseCsv(text){
    text = text.replace(/^\uFEFF/, '');
    const lines = text.split(/\r?\n/);
    const rows = [];
    for(const line of lines){
      if (!line.trim()) continue;
      const row = [];
      let cur = '', inQ = false;
      for (let i=0; i<line.length; i++){
        const ch = line[i];
        if (inQ){
          if (ch === '"'){ if (line[i+1] === '"'){ cur += '"'; i++; } else { inQ = false; } }
          else cur += ch;
        } else {
          if (ch === '"') inQ = true;
          else if (ch === ','){ row.push(cur); cur=''; }
          else cur += ch;
        }
      }
      row.push(cur);
      rows.push(row);
    }
    const header = rows.shift() || [];
    return {header, rows};
  }

  async function loadVacCsv(){
    const base = location.origin + location.pathname.replace(/[^\/]+$/, '');
    const candidates = [
      'sustituciones_diagnostico.csv',
      './sustituciones_diagnostico.csv',
      base + 'sustituciones_diagnostico.csv'
    ];
    let lastErr = null;
    for (const url of candidates){
      try{
        const u = url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now();
        const r = await fetch(u, {cache:'no-store'});
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const txt = await r.text();
        const {header, rows} = parseCsv(txt);
        const idx = (name) => header.findIndex(h => norm(h) === norm(name));
        const iHotel = idx('Hotel'), iFecha = idx('FechaNorm'), iEmp = idx('Empleado');
        const iTipoI = idx('TipoInterpretado'), iTipoA = idx('TipoAusencia');
        if (iHotel<0 || iFecha<0 || iEmp<0) throw new Error('Cabeceras CSV no válidas');
        const out = [];
        for (const r of rows){
          const hotel = r[iHotel]||'', fecha = r[iFecha]||'', emp = r[iEmp]||'';
          const tipo  = ((iTipoI>=0?(r[iTipoI]||''):'') + ' ' + (iTipoA>=0?(r[iTipoA]||''):'')).trim();
          if (fecha && (/vaca/i.test(tipo) || tipo.includes('🏖'))) out.push({hotel, fecha, emp});
        }
        log('CSV vacaciones cargado: ' + out.length + ' filas (' + url + ')');
        return out;
      }catch(e){
        lastErr = e;
        // probar siguiente ruta
      }
    }
    log('CSV no accesible en ninguna ruta. Último error: ' + lastErr);
    return [];
  }

  function weekTables(){
    const tables = Array.from(document.querySelectorAll('table'));
    return tables.filter(tb => {
      const ths = Array.from(tb.querySelectorAll('thead th, tr:first-child th')).map(th=>norm(th.textContent));
      return ths.some(t=>t.includes('empleado'));
    });
  }
  function getHotelFromBlock(block){
    const txt = block.textContent || '';
    const m = txt.match(/^\s*([^\n—-]+?)\s+—\s+Semana/i);
    return m ? m[1].trim() : '';
  }
  function getEmpCol(tb){
    const heads = Array.from(tb.querySelectorAll('thead th, tr:first-child th'));
    let empIdx = heads.findIndex(th => /empleado/i.test(th.textContent));
    return empIdx < 0 ? 0 : empIdx;
  }
  function getDdMmCols(tb){
    const heads = Array.from(tb.querySelectorAll('thead th, tr:first-child th'));
    const cols = [];
    heads.forEach((th, idx) => {
      const m = th.textContent.match(/(\d{1,2})\/(\d{1,2})/);
      if (m) cols.push({idx, dd:('0'+m[1]).slice(-2), mm:('0'+m[2]).slice(-2)});
    });
    return cols;
  }
  function guessYearForHotel(ddmmCols, vacList){
    const years = new Set(vacList.map(v => v.fecha.slice(0,4)));
    if (years.size === 0) return (new Date()).getFullYear();
    let bestY = [...years][0], bestScore = -1;
    for (const y of years){
      let score = 0;
      const setY = new Set(vacList.filter(x => x.fecha.startsWith(y)).map(x => x.fecha.slice(5)));
      for (const c of ddmmCols){ if (setY.has(c.mm + '-' + c.dd)) score++; }
      if (score > bestScore){ bestScore = score; bestY = y; }
    }
    return parseInt(bestY,10);
  }

  function overlayVacaciones(tb, vac, hotelName){
    const empIdx = getEmpCol(tb);
    let ddmmCols = getDdMmCols(tb);
    if (ddmmCols.length === 0){
      const heads = Array.from(tb.querySelectorAll('thead th, tr:first-child th'));
      for (let i=empIdx+1; i<heads.length && ddmmCols.length<7; i++){
        ddmmCols.push({idx:i, dd:null, mm:null});
      }
    }
    const hotelN = norm(hotelName);
    const vacByHotel = vac.filter(v => !hotelN || norm(v.hotel) === hotelN);
    const year = guessYearForHotel(ddmmCols.filter(c=>c.dd && c.mm), vacByHotel.length ? vacByHotel : vac);
    const mapCol2Iso = new Map();
    if (ddmmCols[0] && ddmmCols[0].dd){
      ddmmCols.forEach(c => mapCol2Iso.set(c.idx, year + '-' + (c.mm||'01') + '-' + (c.dd||'01')));
    } else {
      const freq = new Map();
      (vacByHotel.length ? vacByHotel : vac).forEach(v => { freq.set(v.fecha, (freq.get(v.fecha)||0)+1); });
      const top = Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]).slice(0, ddmmCols.length).map(x=>x[0]);
      ddmmCols.forEach((c,i)=> mapCol2Iso.set(c.idx, top[i]||null));
    }
    const rows = Array.from(tb.querySelectorAll('tbody tr')).length ?
                 Array.from(tb.querySelectorAll('tbody tr')) :
                 Array.from(tb.querySelectorAll('tr')).slice(1);
    const byEmp = new Map();
    (vacByHotel.length ? vacByHotel : vac).forEach(v => {
      const k = norm(v.emp);
      if (!byEmp.has(k)) byEmp.set(k, new Set());
      byEmp.get(k).add(v.fecha);
    });
    let marcadas=0, filas=0;
    rows.forEach(tr => {
      const cells = Array.from(tr.children); if (!cells.length) return;
      const empTxt = norm(cells[empIdx]?.textContent || ''); if (!empTxt) return;
      filas++;
      let fechas = null;
      for (const [k,setF] of byEmp.entries()){
        if (empTxt === k || empTxt.includes(' '+k+' ') || empTxt.endsWith(' '+k) || empTxt.startsWith(k+' ')) { fechas = setF; break; }
      }
      if (!fechas) return;
      cells.forEach((td, i) => {
        const iso = mapCol2Iso.get(i); if (!iso) return;
        if (fechas.has(iso)){
          td.dataset.prev = td.textContent.trim();
          td.textContent = 'Vacaciones 🏖️';
          td.classList.add('vacaciones-cell');
          td.title = 'Vacaciones (Sustituciones)';
          marcadas++;
        }
      });
    });
    const styleId='vacaciones-style';
    if (!document.getElementById(styleId)){
      const st = document.createElement('style'); st.id=styleId;
      st.textContent = `.vacaciones-cell{background:#ffecec !important;border:1px solid #ffb3b3 !important;border-radius:20px;font-weight:600}`;
      document.head.appendChild(st);
    }
    log(`Hotel="${hotelName||'(cualquiera)'}" -> filas=${filas}, columnasDias=${ddmmCols.length}, celdas marcadas=${marcadas}`);
  }

  function nightsCount(tb){
    const heads = Array.from(tb.querySelectorAll('thead th, tr:first-child th'));
    let empIdx = heads.findIndex(th => /empleado/i.test(th.textContent)); if (empIdx<0) empIdx=0;
    const dayCols = []; heads.forEach((th, idx) => { if (/\b\d{2}\/\d{2}\b/.test(th.textContent)) dayCols.push(idx); });
    if (!dayCols.length) for (let i=1;i<heads.length;i++) dayCols.push(i);
    const rows = Array.from(tb.querySelectorAll('tbody tr')).length ?
                 Array.from(tb.querySelectorAll('tbody tr')) :
                 Array.from(tb.querySelectorAll('tr')).slice(1);
    const res=[]; let total=0;
    rows.forEach(tr=>{
      const cells=Array.from(tr.children); if(!cells.length) return;
      const empCell=cells[empIdx];
      const tds=dayCols.map(i=>cells[i]).filter(Boolean);
      const cnt=tds.reduce((acc,td)=> acc + (norm(td.textContent).includes('noche') ? 1 : 0), 0);
      res.push({empCell,cnt}); total+=cnt;
    });
    res.forEach(r=>{
      if(!r.empCell) return;
      const prev=r.empCell.querySelector('.badge-night'); if(prev) prev.remove();
      const b=document.createElement('span'); b.className='badge-night'; b.textContent='🌙 '+r.cnt;
      r.empCell.appendChild(b);
    });
    let foot = tb.nextElementSibling;
    if (!foot || !foot.classList || !foot.classList.contains('night-summary')){
      foot=document.createElement('div'); foot.className='night-summary';
      tb.parentNode.insertBefore(foot, tb.nextSibling);
    }
    foot.textContent='🌙 Noches totales en la semana: '+total;
    if (!document.getElementById('night-styles')){
      const st=document.createElement('style'); st.id='night-styles';
      st.textContent='.badge-night{margin-left:.5rem;font-size:.85em;background:#eef;border:1px solid #bbd;border-radius:999px;padding:2px 8px;display:inline-block}.night-summary{font:12px/1.4 system-ui;margin:6px 0 14px 0;color:#334}';
      document.head.appendChild(st);
    }
  }

  async function boot(){
    let tries=0; while (tries++<60 && !weekTables().length){ await new Promise(r=>setTimeout(r,100)); }
    const tables = weekTables();
    if (!tables.length){ log('No se encontraron tablas de cuadrante'); return; }
    const vac = await loadVacCsv();
    if (!vac.length){ log('CSV sin filas de vacaciones.'); }
    tables.forEach(tb => {
      const block = tb.closest('section,div,article') || document.body;
      const hotel = getHotelFromBlock(block);
      overlayVacaciones(tb, vac, hotel);
      nightsCount(tb);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
