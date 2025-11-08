/* plantilla_mobile_adapter.js — Adaptador móvil estable */
(function () {
  "use strict";

  const DAY = 86400000;
  const toISO = (d)=>{ if(!d) return ""; if(typeof d==="string") return d.slice(0,10);
    const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10);};
  const fromISO = (s)=>new Date(s);
  const addDays = (iso,n)=>toISO(new Date(fromISO(iso).getTime()+n*DAY));
  const mondayOf = (any)=>{ const d=typeof any==="string"?new Date(any):new Date(any);
    const wd=(d.getDay()+6)%7; return toISO(new Date(d.getFullYear(),d.getMonth(),d.getDate()-wd)); };

  // ---- Texto limpio (acentos + emojis + etiquetas) ----
  function cleanStr(s){
    return String(s==null?"":s)
      .replace(/Ã¡/g,"á").replace(/Ã©/g,"é").replace(/Ã­/g,"í")
      .replace(/Ã³/g,"ó").replace(/Ãº/g,"ú").replace(/Ã±/g,"ñ")
      .replace(/Ã/g,"Á").replace(/Ã‰/g,"É").replace(/Ã/g,"Í")
      .replace(/Ã“/g,"Ó").replace(/Ãš/g,"Ú").replace(/Ã‘/g,"Ñ")
      .replace(/ðŸ”„/g,"🔄").replace(/ðŸ–ï¸/g,"🏖️").replace(/ï¸/g,"")
      .trim();
  }

  // ---- Normaliza cualquier celda de turno (string u objeto) ----
  function normalizeCell(v){
    if (v==null) return "";
    if (typeof v === "string") {
      let out = cleanStr(v);
      out = out
        .replace(/Noche[\s\S]*$/i,"Noche 🌙")
        .replace(/Descanso[\s\S]*$/i,"Descanso")
        .replace(/Vacaciones[\s\S]*$/i,"Vacaciones 🏖️")
        .replace(/\bC\/T\b|Cambio(?:\s+de)?\s+turno|\u2194|↔/gi,"C/T 🔄");
      return out;
    }
    // Si viene objeto, intenta campos conocidos
    if (typeof v === "object") {
      const cand = v.turno || v.texto || v.tipo || v.nombre || v.name || v.label || "";
      return normalizeCell(cand);
    }
    return cleanStr(v);
  }

  function buildModel(){
    let FD = window.FULL_DATA || window.DATA || window.SCHEDULE || {};

    // --- schedule → semanas (acepta ambas)
    if (!Array.isArray(FD.semanas)) {
      const candidates = [FD.semanas, FD.schedule, FD.data, FD.rows].filter(Array.isArray);
      if (candidates.length) FD.semanas = candidates[0];
    }
    // --- Derivar lista de hoteles
    if (!Array.isArray(FD.hoteles)) {
      const set = new Set();
      if (Array.isArray(FD.semanas)) {
        for (const s of FD.semanas) if (s && s.hotel) set.add(cleanStr(s.hotel));
      }
      FD.hoteles = [...set].map(h => ({ id:h, nombre:h }));
    }

    window.FULL_DATA = FD;
    return FD;
  }

  function pickRowsForWeek(FD, hotel, weekStartISO){
    const rows=[];
    const group = (FD.semanas||[]).filter(s =>
      s && cleanStr(s.hotel)===cleanStr(hotel)
      && toISO(s.semana_lunes||s.weekStart||s.lunes||s.mon)===weekStartISO
    );
    for(const s of group){
      for(const r of (s.turnos||[])){
        rows.push({
          empleado: r.empleado||r.persona||r.nombre,
          fecha: r.fecha,
          turno: normalizeCell(r.turno)
        });
      }
    }
    return rows;
  }

  window.renderContent=function(_FD, opts){
    const FD=buildModel();
    const hotels = FD.hoteles||[];
    const selHotel=(opts&&(opts.hotel||opts.Hotel))||(hotels[0]&&hotels[0].id)||"";
    if(!selHotel){
      (document.getElementById('monthly-summary-container')||document.body).innerHTML=
       '<div class="weekCard"><div class="muted">No se han detectado hoteles en los datos.</div></div>';
      return {monday:mondayOf(new Date()), hotelsAll:hotels};
    }

    const weekStartISO=mondayOf((opts&&(opts.dateFrom||opts.from))||new Date());
    const days=Array.from({length:7},(_,i)=>addDays(weekStartISO,i));
    const rows=pickRowsForWeek(FD, selHotel, weekStartISO);

    const byEmp=new Map();
    for(const r of rows){
      const emp=cleanStr(r.empleado||""); if(!emp) continue;
      if(!byEmp.has(emp)) byEmp.set(emp,{});
      byEmp.get(emp)[toISO(r.fecha)]=normalizeCell(r.turno||"");
    }

    const order=[]; const wk=(FD.semanas||[]).find(s=> s && cleanStr(s.hotel)===cleanStr(selHotel)
      && toISO(s.semana_lunes||s.weekStart||s.lunes||s.mon)===weekStartISO);
    if(wk && Array.isArray(wk.orden_empleados)) order.push(...wk.orden_empleados);
    for(const name of byEmp.keys()){ if(!order.includes(name)) order.push(name); }

    const rowsHtml = order.map(name=>{
      const cells = days.map(d=>`<td>${byEmp.get(name)?.[d]||'—'}</td>`).join('');
      return `<tr><td>${cleanStr(name)}</td>${cells}</tr>`;
    });

    const logo = /cumbria/i.test(selHotel) ? 'img/cumbria.jpg' :
                 (/guadiana/i.test(selHotel) ? 'img/guadiana.jpg' : '');
    const range = `${weekStartISO} → ${addDays(weekStartISO,6)}`;
    const html = `
      <div class="weekCard">
        <div class="weekHead">
          ${logo?`<img class="weekLogo" src="${logo}" alt="">`:''}
          <div><div class="weekTitle">${selHotel}</div><div class="weekRange">${range}</div></div>
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

    (document.getElementById('monthly-summary-container')||document.body).innerHTML = html;
    document.dispatchEvent(new CustomEvent('mobile:rendered'));
    return { monday: weekStartISO, hotelsAll: hotels };
  };
})();
