
// vacaciones_noches_sustitutos_v1.js
// - Lee sustituciones_diagnostico.csv
// - Marca Vacaciones 🏖️
// - Pinta Sustituciones: en el titular ("Lo cubre: X") y en el sustituto ("Cubre a: Y")
// - Mantiene el recuento de noches 🌙
// - Panel de diagnóstico con conteos

(function(){
  function norm(s){
    return (s||'').toLowerCase().normalize('NFD').replace(/\p{Mn}/gu,'')
      .replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
  }
  function panel(){ let p=document.getElementById('vac-debug');
    if(!p){ p=document.createElement('div'); p.id='vac-debug'; p.style.cssText='position:fixed;right:10px;bottom:10px;background:#fff;border:1px solid #ddd;padding:8px 10px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.1);font:12px system-ui;z-index:2147483647;max-width:520px;white-space:pre-wrap;opacity:.95'; document.body.appendChild(p); }
    return p;
  }
  function log(msg){ const p=panel(); p.textContent=(p.textContent?p.textContent+'\n':'')+msg; console.log('[Overlay]', msg); }

  // === CSV helpers ===
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

  async function loadCsv(){
    const base = location.origin + location.pathname.replace(/[^\/]+$/, '');
    const candidates = [
      'sustituciones_diagnostico.csv',
      './sustituciones_diagnostico.csv',
      base + 'sustituciones_diagnostico.csv'
    ];
    let lastErr = null;
    for (const url of candidates){
      try{
        const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'v=' + Date.now(), {cache:'no-store'});
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const txt = await r.text();
        const {header, rows} = parseCsv(txt);
        const idx = (name) => header.findIndex(h => norm(h) === norm(name));
        const iHotel = idx('Hotel'), iFecha = idx('FechaNorm'), iEmp = idx('Empleado');
        const iCambio = idx('CambioDeTurno'), iSust = idx('Sustituto');
        const iTipoI = idx('TipoInterpretado'), iTipoA = idx('TipoAusencia');
        if (iHotel<0 || iFecha<0 || iEmp<0) throw new Error('Cabeceras CSV no válidas');
        const outVac = [], outSub = [];
        for (const r of rows){
          const hotel = r[iHotel]||'', fecha = r[iFecha]||'', emp = r[iEmp]||'';
          const cambio = iCambio>=0 ? (r[iCambio]||'') : '';
          const sust   = iSust>=0 ? (r[iSust]||'') : '';
          const tipo   = ((iTipoI>=0?(r[iTipoI]||''):'') + ' ' + (iTipoA>=0?(r[iTipoA]||''):'')).trim();
          if (!fecha) continue;
          if ((/vaca/i.test(tipo) || tipo.includes('🏖'))) {
            outVac.push({hotel, fecha, emp});
          } else if (cambio || sust){
            outSub.push({hotel, fecha, emp, sust, cambio});
          }
        }
        log('CSV filas: vacaciones=' + outVac.length + ', sustituciones=' + outSub.length + '  (' + url + ')');
        return {vac: outVac, sub: outSub};
      }catch(e){ lastErr = e; /* probar siguiente */ }
    }
    log('CSV no accesible. Último error: ' + lastErr);
    return {vac:[], sub:[]};
  }

  // === Tabla helpers ===
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

  // === Overlay Vacaciones + Sustituciones ===
  function overlayTable(tb, data, hotelName){
    const empIdx = getEmpCol(tb);
    let ddmmCols = getDdMmCols(tb);
    if (ddmmCols.length === 0){
      const heads = Array.from(tb.querySelectorAll('thead th, tr:first-child th'));
      for (let i=empIdx+1; i<heads.length && ddmmCols.length<7; i++){
        ddmmCols.push({idx:i, dd:null, mm:null});
      }
    }
    const hotelN = norm(hotelName);
    const vacList = data.vac.filter(v => !hotelN || norm(v.hotel) === hotelN);
    const subList = data.sub.filter(v => !hotelN || norm(v.hotel) === hotelN);

    const year = guessYearForHotel(ddmmCols.filter(c=>c.dd && c.mm), vacList.length ? vacList : data.vac);
    const mapCol2Iso = new Map();
    if (ddmmCols[0] && ddmmCols[0].dd){
      ddmmCols.forEach(c => mapCol2Iso.set(c.idx, year + '-' + (c.mm||'01') + '-' + (c.dd||'01')));
    } else {
      const freq = new Map();
      (vacList.length ? vacList : data.vac).forEach(v => { freq.set(v.fecha, (freq.get(v.fecha)||0)+1); });
      const top = Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]).slice(0, ddmmCols.length).map(x=>x[0]);
      ddmmCols.forEach((c,i)=> mapCol2Iso.set(c.idx, top[i]||null));
    }

    const rows = Array.from(tb.querySelectorAll('tbody tr')).length ?
                 Array.from(tb.querySelectorAll('tbody tr')) :
                 Array.from(tb.querySelectorAll('tr')).slice(1);

    // Índices por empleado -> Set(fechas)
    const vacByEmp = new Map();
    (vacList.length ? vacList : data.vac).forEach(v => {
      const k = norm(v.emp);
      if (!vacByEmp.has(k)) vacByEmp.set(k, new Set());
      vacByEmp.get(k).add(v.fecha);
    });

    // Sustituciones (lista), añadimos lookup por titular y por sustituto
    const subByTit = new Map();
    const subBySust = new Map();
    (subList.length ? subList : data.sub).forEach(s => {
      const t = norm(s.emp), u = norm(s.sust);
      if (t){
        if (!subByTit.has(t)) subByTit.set(t, new Map());
        const m = subByTit.get(t);
        if (!m.has(s.fecha)) m.set(s.fecha, []);
        m.get(s.fecha).push(s);
      }
      if (u){
        if (!subBySust.has(u)) subBySust.set(u, new Map());
        const m2 = subBySust.get(u);
        if (!m2.has(s.fecha)) m2.set(s.fecha, []);
        m2.get(s.fecha).push(s);
      }
    });

    let marcVac=0, marcTit=0, marcSust=0, filas=0;
    rows.forEach(tr => {
      const cells = Array.from(tr.children);
      if (!cells.length) return;
      const empTxt = norm(cells[empIdx]?.textContent || ''); if (!empTxt) return;
      filas++;

      // Vacaciones
      const setVac = vacByEmp.get(empTxt);
      if (setVac){
        cells.forEach((td, i) => {
          const iso = mapCol2Iso.get(i); if (!iso) return;
          if (setVac.has(iso)){
            td.dataset.prev = td.textContent.trim();
            td.textContent = 'Vacaciones 🏖️';
            td.classList.add('vacaciones-cell');
            td.title = 'Vacaciones (Sustituciones)';
            marcVac++;
          }
        });
      }

      // Sustituciones - titular (Lo cubre: X) — no sobreescribir Vacaciones
      const mapTit = subByTit.get(empTxt);
      if (mapTit){
        cells.forEach((td, i) => {
          const iso = mapCol2Iso.get(i); if (!iso) return;
          if (td.classList.contains('vacaciones-cell')) return; // ya marcado
          const arr = mapTit.get(iso);
          if (arr && arr.length){
            const nombres = Array.from(new Set(arr.map(x => x.sust).filter(Boolean)));
            if (nombres.length){
              const prev = td.textContent.trim();
              td.dataset.prev = prev;
              td.textContent = (prev ? prev + ' | ' : '') + 'Lo cubre: ' + nombres.join(', ');
              td.classList.add('sustituido-cell');
              td.title = 'Sustitución (titular cubierto)';
              marcTit++;
            }
          }
        });
      }

      // Sustituciones - sustituto (Cubre a: Y) — no sobreescribir Vacaciones
      const mapS = subBySust.get(empTxt);
      if (mapS){
        cells.forEach((td, i) => {
          const iso = mapCol2Iso.get(i); if (!iso) return;
          if (td.classList.contains('vacaciones-cell')) return;
          const arr = mapS.get(iso);
          if (arr && arr.length){
            const titulares = Array.from(new Set(arr.map(x => x.emp).filter(Boolean)));
            if (titulares.length){
              const prev = td.textContent.trim();
              td.dataset.prev = prev;
              td.textContent = (prev ? prev + ' | ' : '') + 'Cubre a: ' + titulares.join(', ');
              td.classList.add('sustituto-cell');
              td.title = 'Sustitución (empleado que cubre)';
              marcSust++;
            }
          }
        });
      }
    });

    // estilos
    if (!document.getElementById('overlay-styles')){
      const st = document.createElement('style'); st.id='overlay-styles';
      st.textContent = `
        .vacaciones-cell{background:#ffecec !important;border:1px solid #ffb3b3 !important;border-radius:20px;font-weight:600}
        .sustituido-cell{background:#fff8d6 !important;border:1px solid #e8d38a !important;border-radius:10px}
        .sustituto-cell{background:#e7f9ee !important;border:1px solid #b7e7c7 !important;border-radius:10px}
        .badge-night{margin-left:.5rem;font-size:.85em;background:#eef;border:1px solid #bbd;border-radius:999px;padding:2px 8px;display:inline-block}
        .night-summary{font:12px/1.4 system-ui;margin:6px 0 14px 0;color:#334}
      `;
      document.head.appendChild(st);
    }

    log(`Hotel="${hotelName||'(cualquiera)'}" -> filas=${filas}, dias=${ddmmCols.length}, marcVac=${marcVac}, marcTit=${marcTit}, marcSust=${marcSust}`);
  }

  // === Recuento de noches ===
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
  }

  async function boot(){
    let tries=0; while (tries++<60 && !weekTables().length){ await new Promise(r=>setTimeout(r,100)); }
    const tables = weekTables();
    if (!tables.length){ log('No se encontraron tablas de cuadrante'); return; }
    const data = await loadCsv();
    tables.forEach(tb => {
      const block = tb.closest('section,div,article') || document.body;
      const hotel = getHotelFromBlock(block);
      overlayTable(tb, data, hotel);
      nightsCount(tb);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
