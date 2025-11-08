/* plantilla_mobile_adapter.js — móvil, multi-hotel + dedupe + C/T preservado */
(function () {
  "use strict";

  const DAY = 86400000;
  const toISO = (d)=>{ if(!d) return ""; if(typeof d==="string") return d.slice(0,10);
    const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10);};
  const fromISO = (s)=>new Date(s);
  const addDays = (iso,n)=>toISO(new Date(fromISO(iso).getTime()+n*DAY));
  const mondayOf = (any)=>{ const d=typeof any==="string"?new Date(any):new Date(any);
    const wd=(d.getDay()+6)%7; return toISO(new Date(d.getFullYear(),d.getMonth(),d.getDate()-wd)); };

  // --- Limpieza básica (acentos/artefactos)
  const clean = s => String(s??"")
    .replace(/Ã¡/g,"á").replace(/Ã©/g,"é").replace(/Ã­/g,"í").replace(/Ã³/g,"ó").replace(/Ãº/g,"ú").replace(/Ã±/g,"ñ")
    .replace(/Ã/g,"Á").replace(/Ã‰/g,"É").replace(/Ã/g,"Í").replace(/Ã“/g,"Ó").replace(/Ãš/g,"Ú").replace(/Ã‘/g,"Ñ")
    .replace(/ï¸/g,"").trim();

  function buildModel(){
    let FD = window.FULL_DATA || window.DATA || window.SCHEDULE || {};
    // schedule -> semanas
    if (!Array.isArray(FD.semanas)) {
      const cands=[FD.semanas, FD.schedule, FD.data, FD.rows].filter(Array.isArray);
      if (cands.length) FD.semanas = cands[0];
    }
    // Derivar hoteles
    if (!Array.isArray(FD.hoteles)) {
      const set=new Set();
      (FD.semanas||[]).forEach(s=> s&&s.hotel && set.add(clean(s.hotel)));
      FD.hoteles=[...set].map(h=>({id:h,nombre:h}));
    }
    return FD;
  }
  // Alias de compatibilidad
  window.buildFD = window.buildFD || buildModel;

  // Normaliza cualquier turno conservando C/T si va pegado al turno
  function normTurno(v){
    let t = v;
    if (t && typeof t === "object") t = t.turno || t.texto || t.tipo || t.label || "";
    t = clean(String(t));

    if (!t) return "";
    // etiquetas base
    const isDesc = /descanso/i.test(t);
    const isMan  = /mañana/i.test(t);
    const isTar  = /tarde/i.test(t);
    const isNoc  = /noche/i.test(t);
    const isVac  = /vacaciones/i.test(t);
    const hasCT  = /\bC\/T\b|cambio\s*de\s*turno|↔|↔️|\u2194|\u21C4|🔄/i.test(t);

    // texto limpio + icono C/T si aplica, SIN perder el turno
    let base = "";
    if (isDesc) base = "Descanso";
    else if (isMan) base = "Mañana";
    else if (isTar) base = "Tarde";
    else if (isNoc) base = "Noche 🌙";
    else if (isVac) base = "Vacaciones 🏖️";
    else base = t;

    if (hasCT && !/🔄/.test(base)) base += " 🔄";
    return base;
  }

  function rowsFor(FD, hotel, mondayISO){
    const wk = (FD.semanas||[]).filter(s =>
      s && clean(s.hotel)===clean(hotel) &&
      toISO(s.semana_lunes||s.weekStart||s.lunes||s.mon)===mondayISO
    );
    const rows = [];
    for (const s of wk) for (const r of (s.turnos||[])) {
      rows.push({ empleado: r.empleado||r.persona||r.nombre, fecha: r.fecha, turno: normTurno(r.turno) });
    }
    return rows;
  }

  function renderOne(FD, hotel, mondayISO){
    const days = Array.from({length:7},(_,i)=>addDays(mondayISO,i));
    const rows = rowsFor(FD, hotel, mondayISO);

    // map de días por empleado
    const byEmp = new Map();
    for(const r of rows){
      const emp=clean(r.empleado||""); if(!emp) continue;
      if(!byEmp.has(emp)) byEmp.set(emp,{});
      byEmp.get(emp)[toISO(r.fecha)] = normTurno(r.turno||"");
    }

    // orden de empleados (DE-DUPLICADO)
    const seen=new Set(), order=[];
    const wk=(FD.semanas||[]).find(s=> s && clean(s.hotel)===clean(hotel) &&
      toISO(s.semana_lunes||s.weekStart||s.lunes||s.mon)===mondayISO);
    if (wk && Array.isArray(wk.orden_empleados)) {
      for (const n of wk.orden_empleados) { const k=clean(n); if(!seen.has(k)){ order.push(n); seen.add(k);} }
    }
    for (const n of byEmp.keys()) { const k=clean(n); if(!seen.has(k)){ order.push(n); seen.add(k);} }

    const rowsHtml = order.map(name=>{
      const empKey = clean(name);
      const cells = days.map(d=>`<td>${byEmp.get(empKey)?.[d]||'—'}</td>`).join('');
      return `<tr><td>${empKey}</td>${cells}</tr>`;
    });

    const logo = /cumbria/i.test(hotel) ? 'img/cumbria.jpg' :
                 (/guadiana/i.test(hotel) ? 'img/guadiana.jpg' : '');
    const range = `${mondayISO} → ${addDays(mondayISO,6)}`;

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

  // === API: pinta TODOS si hotel='*' o vacío ===
  window.renderContent=function(_FD, opts){
    const FD = buildModel();
    const hotels = FD.hoteles||[];
    const mondayISO = mondayOf((opts&&(opts.dateFrom||opts.from))||new Date());
    const sel = (opts&&(opts.hotel||opts.Hotel))||"*";

    const list = (!sel || sel==="*") ? hotels : hotels.filter(h=>clean(h.id)===clean(sel));
    let html = list.map(h=>renderOne(FD, h.id, mondayISO)).join("");

    (document.getElementById('monthly-summary-container')||document.body).innerHTML =
      html || '<div class="weekCard"><div class="muted">No hay datos para esa semana.</div></div>';

    document.dispatchEvent(new CustomEvent('mobile:rendered'));
    return { monday: mondayISO, hotelsAll: hotels };
  };
})();
