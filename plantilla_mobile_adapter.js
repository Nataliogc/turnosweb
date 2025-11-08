/* plantilla_mobile_adapter.js — Adaptador móvil para Turnos Web */
(function () {
  "use strict";

  const DAY = 86400000;
  const toISO = (d)=>{ if(!d) return ""; if(typeof d==="string") return d.slice(0,10);
    const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10);};
  const fromISO = (s)=>new Date(s);
  const addDays = (iso,n)=>toISO(new Date(fromISO(iso).getTime()+n*DAY));
  const mondayOf = (any)=>{ const d=typeof any==="string"?new Date(any):new Date(any);
    const wd=(d.getDay()+6)%7; return toISO(new Date(d.getFullYear(),d.getMonth(),d.getDate()-wd)); };

  function normalizeCell(t){ if(!t) return ""; let out=String(t);
    out=out.replace(/MaÃ±ana/g,"Mañana").replace(/Tarde/g,"Tarde")
           .replace(/Noche\s*(?:ð[\u0000-\uFFFF]*|🌙)?/g,"Noche 🌙")
           .replace(/Descanso(?:[^\w]|”|„)*/g,"Descanso")
           .replace(/Vacaciones(?:[^\w]|¤|–|ï¸|–)*/g,"Vacaciones 🏖️")
           .replace(/Baja(?:[^\w]|¤|’|ï¸)*/g,"Baja 🤒")
           .replace(/Permiso(?:[^\w]|ðŸ—“ï¸)*/g,"Permiso 🗓️")
           .replace(/Formaci[oó]n(?:[^\w]|ðŸ“)?/g,"Formación 🎓")
           .replace(/\bC\/T\b|Cambio(?:\s+de)?\s+turno|\u2194/g,"C/T 🔄")
           .replace(/[\uFFFD\u0092\u00AD]/g,"");
    if(/^Noche\s*$/.test(out)) out="Noche 🌙"; return out.trim(); }

  function buildModel(){
    // --- Normalización de origen de datos ---
    // Acepta: FULL_DATA.schedule (index/live), FULL_DATA.semanas (mobile), o cualquier alias común
    if (!Array.isArray(FD.semanas)) {
      const candidates = [
        FD.semanas, FD.schedule, FD.data, FD.rows, (FD.SCHEDULE && FD.SCHEDULE.schedule)
      ].filter(Array.isArray);
      if (candidates.length) FD.semanas = candidates[0];
    }
    // Si no hay lista de hoteles, derivarla de las semanas
    if (!Array.isArray(FD.hoteles)) {
      const set = new Set();
      if (Array.isArray(FD.semanas)) {
        for (const s of FD.semanas) {
          if (s && s.hotel) set.add(String(s.hotel).trim());
        }
      }
      FD.hoteles = [...set].map(h => ({ id: h, nombre: h }));
    }
    
    let FD=window.FULL_DATA || window.DATA || window.SCHEDULE || {};
    if(Array.isArray(FD)) FD={semanas:FD};
    if(!Array.isArray(FD.semanas)){
      const guess=FD.rows||FD.data||FD.turnos||FD.semana||FD.semana_rows||[];
      FD.semanas=Array.isArray(guess)?guess:[];
    }
    if(!Array.isArray(FD.hoteles)){
      const set=new Set(); for(const s of FD.semanas){ if(s&&s.hotel) set.add(String(s.hotel).trim()); }
      FD.hoteles=[...set].map(h=>({id:h,nombre:h}));
    }
    window.FULL_DATA=FD; return FD;
  }

  function pickRowsForWeek(FD, hotel, weekStartISO){
    const rows=[];
    const grouped = FD.semanas.filter(s=> s
      && String(s.hotel).trim()===String(hotel).trim()
      && toISO(s.semana_lunes||s.weekStart||s.lunes||s.mon)===weekStartISO);
    if(grouped.length){
      for(const s of grouped){
        const block=s.turnos||s.rows||s.data||s.empleados||s.personas||[];
        for(const r of block){
          const empleado=r.empleado||r.persona||r.nombre||r.name||"";
          const fecha=toISO(r.fecha||r.dia||r.date||r.f||r.day||r.Fecha||"");
          const turno=(r.turno&&typeof r.turno==="object")
            ? (r.turno.TipoInterpretado||r.turno.TurnoOriginal||r.turno.tramo||"")
            : (r.turno||r.Tramo||r.TipoAusencia||r.TipoInterpretado||r.shift||r.tramo||"");
          if(empleado&&fecha) rows.push({hotel, empleado:String(empleado), fecha, turno});
        }
      }
      return rows;
    }
    for(const r of FD.semanas){
      const h=r.hotel||r.Hotel||r.establecimiento||"";
      if(String(h).trim()!==String(hotel).trim()) continue;
      const fecha=toISO(r.fecha||r.Fecha||r.day||r.date||""); if(!fecha) continue;
      if(mondayOf(fecha)!==weekStartISO) continue;
      const empleado=r.empleado||r.persona||r.nombre||r.name||"";
      const turno=r.turno||r.Tramo||r.TipoAusencia||r.TipoInterpretado||r.shift||r.tramo||"";
      if(empleado) rows.push({hotel:h, empleado:String(empleado), fecha, turno});
    }
    return rows;
  }

  const STYLE=`
  .weekCard{background:#fff;border-radius:14px;box-shadow:0 6px 20px rgba(0,0,0,.06);padding:14px;margin:14px 0}
  .weekHead{display:flex;align-items:center;gap:12px;margin-bottom:10px}
  .weekLogo{width:40px;height:40px;object-fit:contain;border-radius:8px}
  .weekTitle{font:700 1rem system-ui;color:#122}
  .weekRange{font:600 .86rem system-ui;color:#456}
  .grid{width:100%;border-collapse:collapse}
  .grid th,.grid td{border-bottom:1px solid #eef3f7;padding:10px 8px;vertical-align:middle}
  .grid th{font:700 .85rem system-ui;color:#2a3a46;background:#f8fafc}
  .emp{white-space:nowrap;font:600 .95rem system-ui;color:#112}
  .muted{color:#9fb0c0}
  .pill{display:inline-block;padding:.25rem .6rem;border-radius:999px;font:700 .8rem system-ui}
  .pill-am{background:#e7f7ea;color:#136b2c}.pill-pm{background:#fff3d6;color:#7e5b00}
  .pill-night{background:#eae6ff;color:#3e2b84}.pill-off{background:#ffe0e0;color:#8b1b1b}
  .pill-vac{background:#dff5ff;color:#035f88}.pill-low{background:#fde4ff;color:#7b2d86}
  .pill-perm{background:#e9f0ff;color:#274d9c}.pill-form{background:#efe7ff;color:#5b2d91}
  .pill-ct{background:#e6fff2;color:#0f6a45}`; 
  function ensureStyle(){ if(document.getElementById('mobile-inline-style')) return;
    const s=document.createElement('style'); s.id='mobile-inline-style'; s.textContent=STYLE; document.head.appendChild(s); }

  window.populateFilters=function(){
    const FD=buildModel();
    const hotelSelect=document.getElementById('hotelSelect');
    if(!hotelSelect||!Array.isArray(FD.hoteles)) return;
    hotelSelect.innerHTML=FD.hoteles.map(h=>`<option value="${h.id}">${h.nombre||h.id}</option>`).join('');
  };

  window.renderContent=function(_FD, opts){
    ensureStyle();
    const FD=buildModel();
    const hotel=(opts&&(opts.hotel||opts.Hotel))||(FD.hoteles[0]&&FD.hoteles[0].id)||"";
    if(!hotel){
      (document.querySelector('main')||document.body).innerHTML=
       `<div class="weekCard"><div class="muted">No se han detectado hoteles en los datos.</div></div>`;
      return;
    }
    const weekStartISO=mondayOf((opts&&(opts.dateFrom||opts.from))||new Date());
    const days=Array.from({length:7},(_,i)=>addDays(weekStartISO,i));
    const rows=pickRowsForWeek(FD, hotel, weekStartISO);

    const byEmp=new Map();
    for(const r of rows){
      const emp=String(r.empleado||r.persona||r.nombre||"").trim(); if(!emp) continue;
      if(!byEmp.has(emp)) byEmp.set(emp,{});
      byEmp.get(emp)[toISO(r.fecha)]=normalizeCell(r.turno||"");
    }

    const order=[]; const wk=FD.semanas.find(s=> s && String(s.hotel).trim()===String(hotel).trim()
                     && toISO(s.semana_lunes||s.weekStart||s.lunes||s.mon)===weekStartISO);
    if(wk&&Array.isArray(wk.orden_empleados)) for(const e of wk.orden_empleados) order.push(String(e).trim());

    const uniq=new Set([...order,...byEmp.keys()]);
    const rowsHtml=[];
    for(const emp of uniq){
      const map=byEmp.get(emp)||{};
      const tds=days.map(d=>`<td>${map[d]?`<span class="pill">${map[d]}</span>`:'<span class="muted">—</span>'}</td>`).join('');
      rowsHtml.push(`<tr><td class="emp">${emp}</td>${tds}</tr>`);
    }

    const logo=String(hotel).toLowerCase().includes('cumbria')?'img/cumbria.jpg':
               (String(hotel).toLowerCase().includes('guadiana')?'img/guadiana.jpg':'');
    const range=`${weekStartISO} → ${addDays(weekStartISO,6)}`;
    const html=`
      <div class="weekCard">
        <div class="weekHead">
          ${logo?`<img class="weekLogo" src="${logo}" alt="">`:''}
          <div><div class="weekTitle">${hotel}</div><div class="weekRange">${range}</div></div>
        </div>
        <table class="grid">
          <thead><tr>
            <th>Empleado</th>
            <th>Lun<br>${days[0].split('-').reverse().join('/')}</th>
            <th>Mar<br>${days[1].split('-').reverse().join('/')}</th>
            <th>Mié<br>${days[2].split('-').reverse().join('/')}</th>
            <th>Jue<br>${days[3].split('-').reverse().join('/')}</th>
            <th>Vie<br>${days[4].split('-').reverse().join('/')}</th>
            <th>Sáb<br>${days[5].split('-').reverse().join('/')}</th>
            <th>Dom<br>${days[6].split('-').reverse().join('/')}</th>
          </tr></thead>
          <tbody>${rowsHtml.join('')||'<tr><td colspan="8" class="muted">No hay datos para esa semana.</td></tr>'}</tbody>
        </table>
      </div>`;
    (document.getElementById('monthly-summary-container')||document.querySelector('main')||document.body).innerHTML=html;
    document.dispatchEvent(new CustomEvent('mobile:rendered'));
  };
})();

// ---- Exponer API esperada por mobile.app.js ----
if (!window.MobileTemplate) window.MobileTemplate = {};
if (!window.MobileTemplate.renderContent && typeof window.renderContent === 'function') {
  window.MobileTemplate.renderContent = window.renderContent;
}
