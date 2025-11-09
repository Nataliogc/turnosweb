/* móvil: visual mejorada + C/T robusto + ocultar filas vacías */
(function () {
  "use strict";

  const DAY = 86400000;
  const toISO = (d)=>{ if(!d) return ""; if(typeof d==="string") return d.slice(0,10);
    const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,10);};
  const fromISO = (s)=>new Date(s);
  const addDays = (iso,n)=>toISO(new Date(fromISO(iso).getTime()+n*DAY));
  const mondayOf = (any)=>{ const d=typeof any==="string"?new Date(any):new Date(any);
    const wd=(d.getDay()+6)%7; return toISO(new Date(d.getFullYear(),d.getMonth(),d.getDate()-wd)); };

  const clean = s => String(s??"")
    .replace(/Ã¡/g,"á").replace(/Ã©/g,"é").replace(/Ã­/g,"í").replace(/Ã³/g,"ó").replace(/Ãº/g,"ú").replace(/Ã±/g,"ñ")
    .replace(/Ã/g,"Á").replace(/Ã‰/g,"É").replace(/Ã/g,"Í").replace(/Ã“/g,"Ó").replace(/Ãš/g,"Ú").replace(/Ã‘/g,"Ñ")
    .replace(/ðŸ”„/g,"🔄").replace(/ðŸ–ï¸/g,"🏖️").replace(/ï¸/g,"").trim();

  function buildModel(){
    let FD = window.FULL_DATA || window.DATA || window.SCHEDULE || {};
    if (!Array.isArray(FD.semanas)) {
      const c=[FD.semanas, FD.schedule, FD.data, FD.rows].filter(Array.isArray);
      if (c.length) FD.semanas = c[0];
    }
    if (!Array.isArray(FD.hoteles)) {
      const set=new Set();
      (FD.semanas||[]).forEach(s=> s&&s.hotel && set.add(clean(s.hotel)));
      FD.hoteles=[...set].map(h=>({id:h,nombre:h}));
    }
    return FD;
  }
  window.buildFD = window.buildFD || buildModel;

  // --- fechas UI ---
  const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const labelDate = iso=>{
    const [y,m,d] = iso.split("-").map(n=>parseInt(n,10));
    return `${String(d).padStart(2,"0")}/${MONTHS[m-1]}/${String(y).slice(-2)}`;
  };

  // ---------- Turnos ----------
  function truthy(x){ return x===true || x===1 || x==="1" || /^si|sí|true|yes$/i.test(String(x||"")); }

  function parseUnit(val, hasCTFlag){
    let t = val;
    if (t && typeof t === "object") t = t.turno || t.texto || t.tipo || t.label || t.name || "";
    t = clean(String(t));

    const hasCTText = /\bC\/T\b|cambio\s*de\s*turno|cambio\s*turno|CT\b|↔|↔️|\u2194|\u21C4|🔄/i.test(t);
    const hasCT = !!(hasCTFlag || hasCTText);

    const isVac = /vacaciones/i.test(t);
    const isDesc= /descanso/i.test(t);
    const isNoc = /noche/i.test(t);
    const isTar = /tarde/i.test(t);
    const isMan = /mañana/i.test(t);

    let type = "other", label = t;
    if (isVac) {type="va"; label="Vacaciones";}
    else if (isDesc){type="de"; label="Descanso";}
    else if (isNoc){type="no"; label="Noche";}
    else if (isTar){type="ta"; label="Tarde";}
    else if (isMan){type="mn"; label="Mañana";}
    return {type, hasCT, label};
  }

  function mergeUnits(u){
    if (!u || !u.length) return null;
    const prio = ["va","de","no","ta","mn","other"];
    u.sort((a,b)=>prio.indexOf(a.type)-prio.indexOf(b.type));
    const pick = u[0];
    return {type: pick.type, hasCT: u.some(x=>x.hasCT), label: pick.label};
  }

  function normalizeTurno(turno, flags){
    const hasCTFlag = flags && (flags.ct || flags.cambio || flags.cambio_turno || flags.cambioDeTurno || flags.CambioTurno);
    const hasCTBool = truthy(hasCTFlag);
    const units = Array.isArray(turno)
      ? turno.map(x=>parseUnit(x, hasCTBool))
      : [parseUnit(turno, hasCTBool)];
    return mergeUnits(units);
  }

  // ---------- Datos por semana/hotel ----------
  function rowsFor(FD, hotel, mondayISO){
    const wk = (FD.semanas||[]).filter(s =>
      s && clean(s.hotel)===clean(hotel) &&
      toISO(s.semana_lunes||s.weekStart||s.lunes||s.mon)===mondayISO
    );
    const rows = [];
    for (const s of wk) for (const r of (s.turnos||[])) {
      const flags = {
        ct: r.ct, cambio: r.cambio, cambio_turno: r.cambio_turno,
        cambioDeTurno: r.cambioDeTurno, CambioTurno: r.CambioTurno
      };
      rows.push({
        empleado: r.empleado || r.persona || r.nombre || r.Empleado || r.Name || r.worker || "",
        fecha: r.fecha || r.dia || r.date,
        token: normalizeTurno(r.turno, flags)
      });
    }
    return rows;
  }

  function pillHTML(tok){
    if (!tok) return '<span class="pill pill--empty">—</span>';
    const ct = tok.hasCT ? ' 🔄' : '';
    switch (tok.type){
      case "va": return `<span class="pill pill--va">Vacaciones 🏖️</span>`;
      case "de": return `<span class="pill pill--de">Descanso</span>`;
      case "no": return `<span class="pill pill--no">Noche 🌙${ct}</span>`;
      case "ta": return `<span class="pill pill--ta">Tarde${ct}</span>`;
      case "mn": return `<span class="pill pill--mn">Mañana${ct}</span>`;
      default:   return `<span class="pill pill--empty">${clean(tok.label||"—")}</span>`;
    }
  }

  // ---------- Render ----------
  function renderOne(FD, hotel, mondayISO){
    const days = Array.from({length:7},(_,i)=>addDays(mondayISO,i));
    const rows = rowsFor(FD, hotel, mondayISO);

    const byEmp = new Map();
    for(const r of rows){
      const emp=clean(r.empleado||""); if(!emp) continue;
      if(!byEmp.has(emp)) byEmp.set(emp,{});
      byEmp.get(emp)[toISO(r.fecha)] = r.token || null;
    }

    const seen=new Set(), baseOrder=[];
    const wk=(FD.semanas||[]).find(s=> s && clean(s.hotel)===clean(hotel) &&
      toISO(s.semana_lunes||s.weekStart||s.lunes||s.mon)===mondayISO);
    if (wk && Array.isArray(wk.orden_empleados)) {
      for (const n of wk.orden_empleados) { const k=clean(n); if(!seen.has(k)){ baseOrder.push(k); seen.add(k);} }
    }
    for (const n of byEmp.keys()) { const k=clean(n); if(!seen.has(k)){ baseOrder.push(k); seen.add(k);} }

    // Oculta empleados sin turno en toda la semana
    const order = baseOrder.filter(name=>{
      const reg = byEmp.get(name)||{};
      return days.some(d => !!reg[d]);
    });

    const rowsHtml = order.map(name=>{
      const reg = byEmp.get(name)||{};
      const cells = days.map(d=>`<td>${pillHTML(reg[d])}</td>`).join('');
      return `<tr><td>${name}</td>${cells}</tr>`;
    });

    const logo = /cumbria/i.test(hotel) ? 'img/cumbria.jpg' :
                 (/guadiana/i.test(hotel) ? 'img/guadiana.jpg' : '');
    const range = `${labelDate(days[0])} → ${labelDate(days[6])}`;

    const colgroup = `
      <colgroup>
        <col style="width:28%">
        ${Array.from({length:7}).map(()=>'<col style="width: calc(72%/7)"></col>').join('')}
      </colgroup>`;

    // cabecera: cada th con dos líneas controladas (día y fecha abreviada)
    const head = `
      <thead><tr>
        <th>Empleado</th>
        ${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((d,i)=>(
          `<th><span class="dhd">${d}</span><span class="dft">${labelDate(days[i])}</span></th>`
        )).join('')}
      </tr></thead>`;

    return `
      <div class="weekCard">
        <div class="weekHead">
          ${logo?`<img class="weekLogo" src="${logo}" alt="">`:''}
          <div><div class="weekTitle">${hotel}</div><div class="weekRange">${range}</div></div>
        </div>
        <table class="grid grid--fixed">
          ${colgroup}
          ${head}
          <tbody>${rowsHtml.join('')||'<tr><td colspan="8" class="muted">No hay datos para esa semana.</td></tr>'}</tbody>
        </table>
      </div>`;
  }

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
