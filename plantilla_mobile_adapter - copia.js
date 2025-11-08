/* plantilla_mobile_adapter.js — móvil, multi-hotel + píldoras */
(function () {
  "use strict";

  const DAY = 86400000;
  const toISO = (d)=>{ if(!d) return ""; if(typeof d==="string") return d.slice(0,10);
    const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10);};
  const fromISO = (s)=>new Date(s);
  const addDays = (iso,n)=>toISO(new Date(fromISO(iso).getTime()+n*DAY));
  const mondayOf = (any)=>{ const d=typeof any==="string"?new Date(any):new Date(any);
    const wd=(d.getDay()+6)%7; return toISO(new Date(d.getFullYear(),d.getMonth(),d.getDate()-wd)); };

  // ===== Normalización de datos =====
  const clean = s => String(s??"")
    .replace(/Ã¡/g,"á").replace(/Ã©/g,"é").replace(/Ã­/g,"í").replace(/Ã³/g,"ó").replace(/Ãº/g,"ú").replace(/Ã±/g,"ñ")
    .replace(/Ã/g,"Á").replace(/Ã‰/g,"É").replace(/Ã/g,"Í").replace(/Ã“/g,"Ó").replace(/Ãš/g,"Ú").replace(/Ã‘/g,"Ñ")
    .replace(/ðŸ–ï¸/g,"🏖️").replace(/ï¸/g,"").trim();

  function buildFD(){
    let FD = window.FULL_DATA || window.DATA || window.SCHEDULE || {};
    if (!Array.isArray(FD.semanas)) {
      const cands=[FD.semanas, FD.schedule, FD.data, FD.rows].filter(Array.isArray);
      if (cands.length) FD.semanas = cands[0];
    }
    if (!Array.isArray(FD.hoteles)) {
      const set=new Set();
      (FD.semanas||[]).forEach(s=> s&&s.hotel && set.add(clean(s.hotel)));
      FD.hoteles=[...set].map(h=>({id:h,nombre:h}));
    }
    return FD;
  }

  // ===== Render de una celda como píldora =====
  function pill(turnoRaw){
    // soporta string u objeto
    let t = turnoRaw;
    if (t && typeof t === "object") t = t.turno || t.texto || t.tipo || t.label || "";
    t = clean(String(t));

    if (!t) return "—";

    // mapeo robusto
    const isDesc = /descanso/i.test(t);
    const isMan  = /mañana/i.test(t);
    const isTar  = /tarde/i.test(t);
    const isNoc  = /noche/i.test(t);
    const isVac  = /vacaciones/i.test(t);
    const isCT   = /\bC\/T\b|cambio\s*de\s*turno|↔|🔄/i.test(t);

    if (isDesc) return `<span class="pill pill--desc">Descanso</span>`;
    if (isMan)  return `<span class="pill pill--man">Mañana</span>`;
    if (isTar)  return `<span class="pill pill--tar">Tarde</span>`;
    if (isNoc)  return `<span class="pill pill--noc">Noche 🌙</span>`;
    if (isVac)  return `<span class="pill pill--vac">Vacaciones 🏖️</span>`;
    if (isCT)   return `<span class="pill pill--ct">C/T 🔄</span>`;

    return `<span class="pill">${t}</span>`;
  }

  function pickRowsForWeek(FD, hotel, mondayISO){
    const wk = (FD.semanas||[]).filter(s =>
      s && clean(s.hotel)===clean(hotel) &&
      toISO(s.semana_lunes||s.weekStart||s.lunes||s.mon)===mondayISO
    );
    const rows = [];
    for (const s of wk) for (const r of (s.turnos||[])) {
      rows.push({ empleado: r.empleado||r.persona||r.nombre, fecha: r.fecha, turno: r.turno });
    }
    return rows;
  }

  // ===== Render de UNA tarjeta (un hotel) =====
  function renderOne(FD, hotel, weekStartISO){
    const days = Array.from({length:7},(_,i)=>addDays(weekStartISO,i));
    const rows = pickRowsForWeek(FD, hotel, weekStartISO);

    const byEmp = new Map();
    for(const r of rows){
      const emp=clean(r.empleado||""); if(!emp) continue;
      if(!byEmp.has(emp)) byEmp.set(emp,{});
      byEmp.get(emp)[toISO(r.fecha)] = pill(r.turno);
    }

    // orden empleados
    const order=[]; 
    const wk=(FD.semanas||[]).find(s=> s && clean(s.hotel)===clean(hotel) &&
      toISO(s.semana_lunes||s.weekStart||s.lunes||s.mon)===weekStartISO);
    if(wk && Array.isArray(wk.orden_empleados)) order.push(...wk.orden_empleados);
    for(const name of byEmp.keys()){ if(!order.includes(name)) order.push(name); }

    const rowsHtml = order.map(name=>{
      const cells = days.map(d=>`<td>${byEmp.get(name)?.[d]||'—'}</td>`).join('');
      return `<tr><td>${clean(name)}</td>${cells}</tr>`;
    });

    const logo = /cumbria/i.test(hotel) ? 'img/cumbria.jpg' :
                 (/guadiana/i.test(hotel) ? 'img/guadiana.jpg' : '');
    const range = `${weekStartISO} → ${addDays(weekStartISO,6)}`;

    return `
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
  }

  // ===== API principal: ahora puede pintar TODOS o uno =====
  window.renderContent=function(_FD, opts){
    const FD = buildFD();
    const hotels = FD.hoteles||[];
    const mondayISO = mondayOf((opts&&(opts.dateFrom||opts.from))||new Date());
    const sel = (opts&&(opts.hotel||opts.Hotel))||"*"; // "*" => todos

    let html = "";
    if (sel==="*" || !sel) {
      for (const h of hotels) html += renderOne(FD, h.id, mondayISO);
    } else {
      html = renderOne(FD, sel, mondayISO);
    }

    (document.getElementById('monthly-summary-container')||document.body).innerHTML = html || 
      '<div class="weekCard"><div class="muted">No hay datos para esa semana.</div></div>';

    document.dispatchEvent(new CustomEvent('mobile:rendered'));
    return { monday: mondayISO, hotelsAll: hotels };
  };
})();
