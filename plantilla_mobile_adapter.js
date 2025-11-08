/* plantilla_mobile_adapter.js — móvil, multi-hotel + merge de turnos + C/T preservado */
(function () {
  "use strict";

  // ===== Utilidades de fecha =====
  const DAY = 86400000;
  const toISO = (d)=>{ if(!d) return ""; if(typeof d==="string") return d.slice(0,10);
    const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10);};
  const fromISO = (s)=>new Date(s);
  const addDays = (iso,n)=>toISO(new Date(fromISO(iso).getTime()+n*DAY));
  const mondayOf = (any)=>{ const d=typeof any==="string"?new Date(any):new Date(any);
    const wd=(d.getDay()+6)%7; return toISO(new Date(d.getFullYear(),d.getMonth(),d.getDate()-wd)); };

  // ===== Normalización de texto =====
  const clean = s => String(s??"")
    .replace(/Ã¡/g,"á").replace(/Ã©/g,"é").replace(/Ã­/g,"í").replace(/Ã³/g,"ó").replace(/Ãº/g,"ú").replace(/Ã±/g,"ñ")
    .replace(/Ã/g,"Á").replace(/Ã‰/g,"É").replace(/Ã/g,"Í").replace(/Ã“/g,"Ó").replace(/Ãš/g,"Ú").replace(/Ã‘/g,"Ñ")
    .replace(/ðŸ”„/g,"🔄").replace(/ðŸ–ï¸/g,"🏖️").replace(/ï¸/g,"").trim();

  // ===== Lectura de fuente =====
  function buildModel(){
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
  // alias de compatibilidad
  window.buildFD = window.buildFD || buildModel;

  // ===== Detección de turno base + flag C/T =====
  function parseUnit(val){
    // val puede ser string u objeto
    let t = val;
    if (t && typeof t === "object") t = t.turno || t.texto || t.tipo || t.label || t.name || "";
    t = clean(String(t));

    const hasCT = /\bC\/T\b|cambio\s*de\s*turno|↔|↔️|\u2194|\u21C4|🔄/i.test(t);
    const isVac = /vacaciones/i.test(t);
    const isDesc= /descanso/i.test(t);
    const isNoc = /noche/i.test(t);
    const isTar = /tarde/i.test(t);
    const isMan = /mañana/i.test(t);

    let base = "";
    if (isVac) base = "Vacaciones";
    else if (isDesc) base = "Descanso";
    else if (isNoc) base = "Noche";
    else if (isTar) base = "Tarde";
    else if (isMan) base = "Mañana";
    else base = t || "";

    return {base, hasCT};
  }

  // Fusión de varias piezas del mismo día
  function mergeUnits(units){
    // units: array de {base, hasCT}
    if (!units || !units.length) return "";
    // prioridad
    const order = ["Vacaciones","Descanso","Noche","Tarde","Mañana"];
    let pick = "";
    for (const p of order){
      if (units.some(u=>u.base && u.base.toLowerCase().startsWith(p.toLowerCase()))) { pick = p; break; }
    }
    if (!pick) pick = units.find(u=>u.base)?.base || "";
    const anyCT = units.some(u=>u.hasCT);
    if (!pick) return "";
    if (/Noche/i.test(pick)) return pick + " 🌙" + (anyCT?" 🔄":"");
    if (/Vacaciones/i.test(pick)) return pick + " 🏖️";
    return pick + (anyCT?" 🔄":"");
  }

  // Convierte cualquier entrada a string normalizado
  function normalizeTurno(v){
    if (Array.isArray(v)) {
      const units = v.map(parseUnit);
      return mergeUnits(units);
    }
    return mergeUnits([parseUnit(v)]);
  }

  // ===== Filtrado y construcción por semana/hotel =====
  function rowsFor(FD, hotel, mondayISO){
    const wk = (FD.semanas||[]).filter(s =>
      s && clean(s.hotel)===clean(hotel) &&
      toISO(s.semana_lunes||s.weekStart||s.lunes||s.mon)===mondayISO
    );
    const rows = [];
    for (const s of wk) for (const r of (s.turnos||[])) {
      rows.push({
        empleado: r.empleado||r.persona||r.nombre,
        fecha: r.fecha,
        turno: normalizeTurno(r.turno)
      });
    }
    return rows;
  }

  // ===== Render de UNA tarjeta (hotel) =====
  function renderOne(FD, hotel, mondayISO){
    const days = Array.from({length:7},(_,i)=>addDays(mondayISO,i));
    const rows = rowsFor(FD, hotel, mondayISO);

    const byEmp = new Map();
    for(const r of rows){
      const emp=clean(r.empleado||""); if(!emp) continue;
      if(!byEmp.has(emp)) byEmp.set(emp,{});
      byEmp.get(emp)[toISO(r.fecha)] = r.turno || "";
    }

    // orden de empleados (sin duplicados)
    const seen=new Set(), order=[];
    const wk=(FD.semanas||[]).find(s=> s && clean(s.hotel)===clean(hotel) &&
      toISO(s.semana_lunes||s.weekStart||s.lunes||s.mon)===mondayISO);
    if (wk && Array.isArray(wk.orden_empleados)) {
      for (const n of wk.orden_empleados) { const k=clean(n); if(!seen.has(k)){ order.push(k); seen.add(k);} }
    }
    for (const n of byEmp.keys()) { const k=clean(n); if(!seen.has(k)){ order.push(k); seen.add(k);} }

    const rowsHtml = order.map(name=>{
      const cells = days.map(d=>`<td>${byEmp.get(name)?.[d]||'—'}</td>`).join('');
      return `<tr><td>${name}</td>${cells}</tr>`;
    });

    const logo = /cumbria/i.test(hotel) ? 'img/cumbria.jpg' :
                 (/guadiana/i.test(hotel) ? 'img/guadiana.jpg' : '');
    const range = `${mondayISO} → ${addDays(mondayISO,6)}`;

    // colgroup para columnas homogéneas
    const colgroup = `
      <colgroup>
        <col span="1" style="width:20%">
        <col span="7" style="width:80%">
      </colgroup>`;

    return `
      <div class="weekCard">
        <div class="weekHead">
          ${logo?`<img class="weekLogo" src="${logo}" alt="">`:''}
          <div><div class="weekTitle">${hotel}</div><div class="weekRange">${range}</div></div>
        </div>
        <table class="grid grid--fixed">
          ${colgroup}
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

  // ===== API principal (pinta todos si hotel="*" o vacío) =====
  window.renderContent=function(_FD, opts){
    const FD = buildModel();
    const hotels = FD.hoteles||[];
    const mondayISO = mondayOf((opts&&(opts.dateFrom||opts.from))||new Date());
    const sel = (opts&&(opts.hotel||opts.Hotel))||"*";

    const list = (!sel || sel==="*") ? hotels : hotels.filter(h=>clean(h.id)===clean(sel));
    const html = list.map(h=>renderOne(FD, h.id, mondayISO)).join("");

    (document.getElementById('monthly-summary-container')||document.body).innerHTML =
      html || '<div class="weekCard"><div class="muted">No hay datos para esa semana.</div></div>';

    document.dispatchEvent(new CustomEvent('mobile:rendered'));
    return { monday: mondayISO, hotelsAll: hotels };
  };
})();
