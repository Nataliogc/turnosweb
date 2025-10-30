/* Turnos Web · mobile.patch.js (arreglado)
   - Sin variables duplicadas (weeks)
   - Filtros hotel/empleado/rango
   - Dos hoteles por semana
   - Logos, cabeceras día (LUNES / 01/nov/25)
   - Orden plantilla + sustituciones (↔)
*/
(function () {
  "use strict";

  // ===== Utiles =====
  const DAY = 86400000;
  const toDate = v => (v instanceof Date ? v : new Date(v));
  const iso = d => new Date(d).toISOString().slice(0, 10);
  const norm = s => (s||"").toString().normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
  const esWeekday = d => new Intl.DateTimeFormat("es-ES",{weekday:"long"}).format(toDate(d)).toUpperCase();
  const esMini = d => {
    const dt = toDate(d);
    const dd = String(dt.getDate()).padStart(2,"0");
    const mmm = new Intl.DateTimeFormat("es-ES",{month:"short"}).format(dt).replace(".","");
    const yy = String(dt.getFullYear()).slice(-2);
    return `${dd}/${mmm}/${yy}`.toLowerCase();
  };
  const weekDays = monISO => Array.from({length:7},(_,i)=>iso(toDate(monISO).getTime()+i*DAY));
  function normalizeTurno(raw){
    const t = norm(raw);
    if (!t || t==="—" || t==="-" || t==="_") return {label:"—", cls:"pill-empty"};
    if (t.includes("descanso")) return {label:"Descanso", cls:"pill-x"};
    if (t.includes("mañana")||t.includes("manana")) return {label:"Mañana", cls:"pill-m"};
    if (t.includes("tarde")) return {label:"Tarde", cls:"pill-t"};
    if (t.includes("noche")) return {label:"Noche 🌙", cls:"pill-n"};
    if (t.includes("vacac")) return {label:"Vacaciones", cls:"pill-x"};
    if (t.includes("baja")) return {label:"Baja", cls:"pill-x"};
    return {label: raw, cls:"pill-txt"};
  }

  // ===== Datos =====
  function pickSource(){
    const S = (window.FULL_DATA && Object.keys(window.FULL_DATA).length ? window.FULL_DATA :
               window.DATA && Object.keys(window.DATA).length ? window.DATA : {}) || {};
    if (!Array.isArray(S.schedule) || !S.schedule.length){
      const rows = Array.isArray(S.data) ? S.data : (Array.isArray(S.rows) ? S.rows : []);
      if (rows.length){
        const by = new Map();
        for (const r of rows){
          const hotel = r.hotel || r.Hotel || r.establecimiento || r.Establecimiento || "";
          const empleado = r.empleado || r.Empleado || r.employee || r.nombre || r.name || r.persona || "";
          const fecha = iso(r.fecha || r.Fecha || r.date || r.day || r.dia);
          const turno = r.turno || r.Turno || r.shift || r.tramo || r.TipoAusencia || r.ausencia || "";
          if (!hotel || !empleado || !fecha) continue;
          const d = toDate(fecha);
          const mon = iso(d.getTime() - (((d.getDay()+6)%7)*DAY));
          const key = `${hotel}|${mon}`;
          if (!by.has(key)) by.set(key, {hotel, semana_lunes:mon, orden_empleados:new Set(), turnos:[]});
          const obj = by.get(key);
          obj.orden_empleados.add(empleado);
          obj.turnos.push({empleado, fecha, turno});
        }
        S.schedule = Array.from(by.values()).map(o=>({
          hotel:o.hotel, semana_lunes:o.semana_lunes,
          orden_empleados:[...o.orden_empleados], turnos:o.turnos
        }));
      } else {
        S.schedule = [];
      }
    }
    S.sustituciones = Array.isArray(S.sustituciones) ? S.sustituciones : [];
    return S;
  }
  const SRC = pickSource();

  // ===== UI & Estado =====
  const UI = {
    app:   document.getElementById("app"),
    hotel: document.getElementById("hotelSelect"),
    emp:   document.getElementById("employeeFilter"),
    from:  document.getElementById("dateFrom"),
    to:    document.getElementById("dateTo"),
    prev:  document.getElementById("btnPrev"),
    next:  document.getElementById("btnNext"),
    today: document.getElementById("btnToday"),
  };
  const STATE = { hotel:"", emp:"", from:"", to:"", weekCursor:null };

  function allHotels(){ const s=new Set(); (SRC.schedule||[]).forEach(x=>s.add(x.hotel)); return [...s]; }
  function allEmployees(){ const s=new Set(); (SRC.schedule||[]).forEach(x=>(x.orden_empleados||[]).forEach(e=>s.add(e))); return [...s]; }

  function initFilters(){
    if (UI.hotel && UI.hotel.children.length<=1) allHotels().forEach(h=>{ const o=document.createElement("option"); o.value=h; o.textContent=h; UI.hotel.appendChild(o); });
    if (UI.emp && UI.emp.children.length<=1) allEmployees().forEach(e=>{ const o=document.createElement("option"); o.value=e; o.textContent=e; UI.emp.appendChild(o); });
    const t=new Date(); const mon=new Date(t.getTime()-(((t.getDay()+6)%7)*DAY));
    if (UI.from && !UI.from.value) UI.from.value = iso(mon);
    if (UI.to && !UI.to.value) UI.to.value = iso(mon.getTime()+21*DAY);
    STATE.from = UI.from?.value || ""; STATE.to = UI.to?.value || "";
    STATE.hotel= UI.hotel?.value||"";  STATE.emp= UI.emp?.value||"";
    STATE.weekCursor = iso(mon);
  }
  function applyFilters(){
    STATE.hotel=UI.hotel?.value||""; STATE.emp=UI.emp?.value||"";
    STATE.from=UI.from?.value||"";   STATE.to=UI.to?.value||"";
    render();
  }
  document.getElementById("btnApply")?.addEventListener("click",e=>{e.preventDefault(); applyFilters(); document.querySelector("dialog")?.close();});
  UI.prev?.addEventListener("click",()=>{ STATE.weekCursor = iso(toDate(STATE.weekCursor).getTime()-7*DAY); render(); });
  UI.next?.addEventListener("click",()=>{ STATE.weekCursor = iso(toDate(STATE.weekCursor).getTime()+7*DAY); render(); });
  UI.today?.addEventListener("click",()=>{ const t=new Date(); const m=iso(t.getTime()-(((t.getDay()+6)%7)*DAY)); STATE.weekCursor=m; render(); });

  // ===== Sustituciones =====
  function sustMap(hotel, monISO){
    const wk = weekDays(monISO);
    const inRange=(d,a,b)=>{ const x=toDate(d).getTime(), A=a?toDate(a).getTime():-Infinity, B=b?toDate(b).getTime():Infinity; return x>=A && x<=B; };
    const rel = SRC.sustituciones.filter(s=>norm(s.hotel)===norm(hotel));
    const map=new Map();
    rel.forEach(s=>{ if (wk.every(d=>inRange(d,s.desde,s.hasta))) map.set(s.titular, s.sustituto); });
    return map;
  }

  // ===== Render =====
  function render(){
    const root = UI.app; if(!root) return;
    root.innerHTML = "";

    if (!SRC.schedule.length){
      const p=document.createElement("p"); p.className="meta"; p.textContent="No hay datos para mostrar con los filtros seleccionados."; root.appendChild(p); return;
    }

    initFilters();

    // Agrupar por semana
    const byWeek = new Map(); // mon -> [sched]
    for (const s of SRC.schedule){
      if (STATE.hotel && s.hotel!==STATE.hotel) continue;
      if (!byWeek.has(s.semana_lunes)) byWeek.set(s.semana_lunes, []);
      byWeek.get(s.semana_lunes).push(s);
    }
    const weekKeys = [...byWeek.keys()].sort();
    let showKey = STATE.weekCursor || weekKeys[0];
    if (showKey && !byWeek.has(showKey)) showKey = weekKeys[0];

    const weeksToRender = showKey ? [showKey] : weekKeys;

    for (const wk of weeksToRender){
      const hotels = (byWeek.get(wk)||[]).sort((a,b)=>norm(a.hotel).localeCompare(norm(b.hotel)));

      const group = document.createElement("section"); group.className="week-group"; root.appendChild(group);

      for (const sem of hotels){
        const {hotel, semana_lunes, orden_empleados=[], turnos=[]} = sem;
        const dias = weekDays(semana_lunes);
       const logo = /cumbria/i.test(hotel) ? "cumbria logo.jpg"
            : /guadiana/i.test(hotel) ? "guadiana logo.jpg"
            : "icons/icon-192.png";


        // índice turnos
        const idx = new Map();
        for (const t of turnos){
          const f = iso(t.fecha || t.date || t.dia);
          idx.set(`${t.empleado}__${f}`, t.turno || t.TipoAusencia || t.shift || t.tramo || "");
        }

        // Ausentes toda semana + sustituciones
        const S = sustMap(hotel, semana_lunes);
        const aus = new Set();
        const ordFinal = [];
        for (const emp of orden_empleados){
          const allOff = dias.every(d=>{
            const raw = idx.get(`${emp}__${d}`)||"";
            const L = normalizeTurno(raw).label;
            return L==="—"||L==="Descanso"||L==="Vacaciones"||L==="Baja";
          });
          if (allOff) aus.add(emp);
        }
        for (const emp of orden_empleados){
          if (aus.has(emp) && S.has(emp)) ordFinal.push({emp:S.get(emp), mark:`↔ ${emp}`});
          else if (!aus.has(emp)) ordFinal.push({emp, mark:""});
        }
        orden_empleados.forEach(e=>{ if (aus.has(e)) ordFinal.push({emp:e, mark:""}); });

        // Filtro de empleado
        const filas = STATE.emp ? ordFinal.filter(x=>x.emp===STATE.emp) : ordFinal;

        // ---- Card ----
        const card = document.createElement("article"); card.className="row-card week"; group.appendChild(card);
        const head = document.createElement("div"); head.className="week-head";
        head.innerHTML = `<img src="${logo}" alt="" style="width:40px;height:40px;border-radius:8px;object-fit:cover">
          <div><div style="font-weight:700">${hotel} – Semana ${semana_lunes}</div>
          <div style="color:#6b7280;font-size:12px">${dias[0]} → ${dias[6]}</div></div>`;
        card.appendChild(head);

        const tbl = document.createElement("table"); tbl.className="grid-week";
        const thead = document.createElement("thead");
        const trh = document.createElement("tr");
        let th = `<th style="text-align:left">Empleados</th>`;
        th += dias.map(d=>`<th><div style="font-size:11px;font-weight:700">${esWeekday(d)}</div><div style="font-size:12px;color:#6b7280">${esMini(d)}</div></th>`).join("");
        trh.innerHTML = th; thead.appendChild(trh); tbl.appendChild(thead);

        const tbody = document.createElement("tbody");
        function turnoOf(emp,d){
          const raw = idx.get(`${emp}__${d}`);
          if (raw) return raw;
          const titular = [...S.entries()].find(([tit,sub])=>sub===emp)?.[0];
          if (titular){ return idx.get(`${titular}__${d}`) || ""; }
          return "";
        }
        for (const {emp, mark} of filas){
          const tr = document.createElement("tr");
          const name = document.createElement("td"); name.style.textAlign="left"; name.textContent = emp + (mark?`  ${mark}`:""); tr.appendChild(name);
          for (const d of dias){
            const td=document.createElement("td");
            const n = normalizeTurno( turnoOf(emp,d) );
            if (n.label==="—"){ td.textContent="—"; }
            else { const span=document.createElement("span"); span.className=`pill ${n.cls}`; span.textContent=n.label; td.appendChild(span); }
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        tbl.appendChild(tbody); card.appendChild(tbl);
      }
    }

    // Maquetación (sin duplicar variables):
    const cards = [...root.querySelectorAll(".week")];
    if (cards.length){
      const wrap=document.createElement("div"); wrap.className="weeks-grid";
      cards.forEach(c=>wrap.appendChild(c));
      root.innerHTML=""; root.appendChild(wrap);
    }
  }

  document.addEventListener("DOMContentLoaded", ()=>{ initFilters(); render(); });
})();
