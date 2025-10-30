/* Turnos Web · mobile.patch.js (SOLO app móvil) */
(function () {
  "use strict";

  // ---------- Utils ----------
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

  // Convierte cualquier valor a string legible (evita [object Object])
  function asText(v) {
    if (v == null) return "";
    if (typeof v === "string") return v;
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (typeof v === "object") return v.turno || v.Turno || v.label || v.text || v.tipo || v.name || "";
    try { return String(v); } catch { return ""; }
  }

  // Píldoras oficiales
  function normalizeTurno(raw){
    const t = norm(asText(raw));
    if (!t || t==="—" || t==="-" || t==="_") return {label:"—", cls:"pill-empty"};
    if (t.includes("descanso")) return {label:"Descanso", cls:"pill-x"};
    if (t.includes("mañana")||t.includes("manana")) return {label:"Mañana", cls:"pill-m"};
    if (t.includes("tarde")) return {label:"Tarde", cls:"pill-t"};
    if (t.includes("noche")) return {label:"Noche 🌙", cls:"pill-n"};
    if (t.includes("vacac")) return {label:"Vacaciones", cls:"pill-x"};
    if (t.includes("baja")) return {label:"Baja", cls:"pill-x"};
    return {label: asText(raw), cls:"pill-txt"};
  }

  // ---------- Datos ----------
  function pickSource(){
    const S = (window.FULL_DATA && Object.keys(window.FULL_DATA).length ? window.FULL_DATA :
               window.DATA && Object.keys(window.DATA).length ? window.DATA : {}) || {};
    // Si no hay schedule, intentamos construirlo desde data/rows
    if (!Array.isArray(S.schedule) || !S.schedule.length){
      const rows = Array.isArray(S.data) ? S.data : (Array.isArray(S.rows) ? S.rows : []);
      if (rows.length){
        const by = new Map();
        for (const r of rows){
          const hotel = r.hotel || r.Hotel || r.establecimiento || r.Establecimiento || "";
          const empleado = r.empleado || r.Empleado || r.employee || r.nombre || r.name || r.persona || "";
          const fecha = iso(r.fecha || r.Fecha || r.date || r.day || r.dia);
          const turno = asText(r.turno || r.Turno || r.shift || r.tramo || r.TipoAusencia || r.ausencia || r);
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

  // ---------- UI / Estado ----------
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

  function allHotels(){ return [...new Set((SRC.schedule||[]).map(s=>s.hotel))]; }
  function allEmployees(){ const s=new Set(); (SRC.schedule||[]).forEach(x=>(x.orden_empleados||[]).forEach(e=>s.add(e))); return [...s]; }

  function initFilters(){
    if (UI.hotel && UI.hotel.children.length<=1) allHotels().forEach(h=>{ const o=document.createElement("option"); o.value=h; o.textContent=h; UI.hotel.appendChild(o); });
    if (UI.emp && UI.emp.children.length<=1) allEmployees().forEach(e=>{ const o=document.createElement("option"); o.value=e; o.textContent=e; UI.emp.appendChild(o); });
    const t=new Date(); const mon=new Date(t.getTime()-(((t.getDay()+6)%7)*DAY));
    if (UI.from && !UI.from.value) UI.from.value = iso(mon);
    if (UI.to   && !UI.to.value)   UI.to.value   = iso(mon.getTime()+21*DAY);
    STATE.from = UI.from?.value || ""; STATE.to = UI.to?.value || "";
    STATE.hotel= UI.hotel?.value||"";  STATE.emp= UI.emp?.value||"";
    STATE.weekCursor = iso(mon);
  }
  function applyFilters(){
    STATE.hotel = UI.hotel?.value || "";
    STATE.emp   = UI.emp?.value   || "";
    STATE.from  = UI.from?.value  || "";
    STATE.to    = UI.to?.value    || "";
    render();
  }
  document.getElementById("btnApply")?.addEventListener("click", e=>{ e.preventDefault(); applyFilters(); document.querySelector("dialog")?.close(); });

  // Semanas disponibles y navegación
  function allWeekKeys() { return [...new Set((SRC.schedule||[]).map(s=>s.semana_lunes))].sort(); }
  function snapCursor(){
    const keys = allWeekKeys(); if (!keys.length) return null;
    if (!STATE.weekCursor || !keys.includes(STATE.weekCursor)){
      const today = new Date();
      STATE.weekCursor = (keys.map(k=>[k, Math.abs(new Date(k)-today)]).sort((a,b)=>a[1]-b[1])[0]||[])[0] || keys[0];
    }
    return keys;
  }
  function moveWeek(delta){
    const keys = snapCursor(); if (!keys) return;
    let i = keys.indexOf(STATE.weekCursor); if (i<0) i=0;
    i = Math.min(Math.max(i+delta, 0), keys.length-1);
    STATE.weekCursor = keys[i];
    render();
  }
  UI.prev?.addEventListener("click", ()=>moveWeek(-1));
  UI.next?.addEventListener("click", ()=>moveWeek(+1));
  UI.today?.addEventListener("click", ()=>{ STATE.weekCursor=null; render(); });

  // ---------- Sustituciones ----------
  function sustMap(hotel, monISO){
    const wk = weekDays(monISO);
    const inRange=(d,a,b)=>{ const x=toDate(d).getTime(), A=a?toDate(a).getTime():-Infinity, B=b?toDate(b).getTime():Infinity; return x>=A && x<=B; };
    const rel = SRC.sustituciones.filter(s=>norm(s.hotel)===norm(hotel));
    const map=new Map();
    rel.forEach(s=>{ if (wk.every(d=>inRange(d,s.desde,s.hasta))) map.set(s.titular, s.sustituto); });
    return map;
  }

  // ---------- Render ----------
  function render(){
    const root = UI.app; if (!root) return;
    root.innerHTML = "";

    if (!SRC.schedule.length){
      const p=document.createElement("p"); p.className="meta"; p.textContent="Listo. Abre Filtros, elige Hotel/Rango y pulsa Aplicar."; root.appendChild(p);
      return;
    }

    initFilters(); snapCursor();

    // Agrupar por semana (y aplicar filtro de hotel si existe)
    const byWeek = new Map();
    for (const s of SRC.schedule){
      if (STATE.hotel && s.hotel!==STATE.hotel) continue;
      if (!byWeek.has(s.semana_lunes)) byWeek.set(s.semana_lunes, []);
      byWeek.get(s.semana_lunes).push(s);
    }

    const targetWeek = STATE.weekCursor;
    const items = (byWeek.get(targetWeek)||[]).sort((a,b)=>norm(a.hotel).localeCompare(norm(b.hotel)));

    // Contenedor de semana (ambos hoteles)
    const section = document.createElement("section");
    section.className="week-group";
    root.appendChild(section);

    for (const sem of items){
      const {hotel, semana_lunes, orden_empleados=[], turnos=[]} = sem;
      const dias = weekDays(semana_lunes);

      // índice por empleado/día
      const idx = new Map();
      for (const t of turnos){
        const f = iso(t.fecha || t.date || t.dia);
        idx.set(`${t.empleado}__${f}`, asText(t.turno || t.TipoAusencia || t.shift || t.tramo || t));
      }

      // Ausentes toda semana y sustituciones
      const S = sustMap(hotel, semana_lunes);
      const aus = new Set();
      for (const emp of orden_empleados){
        const allOff = dias.every(d=>{
          const n = normalizeTurno(idx.get(`${emp}__${d}`) || "");
          return n.label==="—"||n.label==="Descanso"||n.label==="Vacaciones"||n.label==="Baja";
        });
        if (allOff) aus.add(emp);
      }
      const ordenFinal = [];
      for (const emp of orden_empleados){
        if (aus.has(emp) && S.has(emp)) ordenFinal.push({emp:S.get(emp), mark:`↔ ${emp}`});
        else if (!aus.has(emp))        ordenFinal.push({emp, mark:""});
      }
      orden_empleados.forEach(e=>{ if (aus.has(e)) ordenFinal.push({emp:e, mark:""}); });

      // Filtro de empleado
      const filas = STATE.emp ? ordenFinal.filter(x=>x.emp===STATE.emp) : ordenFinal;

      // ---- Card por hotel ----
      const card = document.createElement("article"); card.className="row-card week"; section.appendChild(card);

      const logo = /cumbria/i.test(hotel) ? "cumbria logo.jpg"
                : /guadiana/i.test(hotel) ? "guadiana logo.jpg" : "icons/icon-192.png";

      const head = document.createElement("div"); head.className="week-head";
      head.innerHTML = `<img src="${logo}" alt="" onerror="this.src='icons/icon-192.png'"
                          style="width:40px;height:40px;border-radius:8px;object-fit:cover">
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
        if (raw) return asText(raw);
        const titular = [...S.entries()].find(([tit,sub])=>sub===emp)?.[0];
        if (titular) return asText(idx.get(`${titular}__${d}`) || "");
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

    // Maquetación de cards (una vez renderizado)
    const cards = [...root.querySelectorAll(".week")];
    if (cards.length){
      const wrap=document.createElement("div"); wrap.className="weeks-grid";
      cards.forEach(c=>wrap.appendChild(c));
      root.innerHTML=""; root.appendChild(wrap);
    }
  }

  document.addEventListener("DOMContentLoaded", ()=>{ initFilters(); render(); });
})();
