/* Turnos Web · mobile.patch.js (solo APP móvil)
   Sustituciones por día con motivo + por rango; ↔ y motivo visible; fixes de "Mañana";
   navegación de semanas y filtros robustos. NO toca index/desktop.
*/
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

  // Normaliza etiquetas de turno → clases
  function normalizeTurno(raw){
    let s = asText(raw);

    // Fix codificación común de “Mañana”
    const bad = ["maÃ±ana","maã±ana","maÃƒÂ±ana","maƒâ€˜ana"];
    if (bad.some(b => s.toLowerCase().includes(b))) s = "Mañana";

    const t = norm(s);
    if (!t || t==="—" || t==="-" || t==="_") return {label:"—", cls:"pill-empty"};
    if (t.includes("descanso")) return {label:"Descanso", cls:"pill-x"};
    if (t.includes("mañana")||t.includes("manana")) return {label:"Mañana", cls:"pill-m"};
    if (t.includes("tarde")) return {label:"Tarde", cls:"pill-t"};
    if (t.includes("noche")) return {label:"Noche 🌙", cls:"pill-n"};
    if (t.includes("vacac")) return {label:"Vacaciones", cls:"pill-x"};
    if (t.includes("baja")) return {label:"Baja", cls:"pill-x"};
    return {label: s, cls:"pill-txt"};
  }

  // ---------- Datos ----------
  function pickSource(){
    const S = (window.FULL_DATA && Object.keys(window.FULL_DATA).length ? window.FULL_DATA :
               window.DATA && Object.keys(window.DATA).length ? window.DATA : {}) || {};

    // Si no hay schedule, intentalo desde data/rows
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

    // Sustituciones: admitimos tres formatos:
    //  A) rango: {hotel,titular,sustituto,desde,hasta,motivo?}
    //  B) por día: {hotel,fecha,titular,sustituto,motivo}
    //  C) fila genérica (de DATA.rows) con columnas variadas ('Motivo','C/T'…)
    const sus = Array.isArray(S.sustituciones) ? S.sustituciones : [];
    const rows = Array.isArray(S.data) ? S.data : (Array.isArray(S.rows) ? S.rows : []);
    S.__sust_por_dia = []; // forma normalizada
    S.__sust_por_rango = [];

    // De S.sustituciones ya normalizadas
    sus.forEach(x=>{
      const hotel = x.hotel || x.Hotel;
      const titular = x.titular || x.Titular || x.empleado || x.Empleado;
      const sustituto = x.sustituto || x.Sustituto;
      const motivo = x.motivo || x.Motivo || x.razon || x.Razon || x.Observaciones || x.observaciones || "";
      if (x.fecha || x.Fecha){
        S.__sust_por_dia.push({hotel, fecha: iso(x.fecha || x.Fecha), titular, sustituto, motivo});
      } else {
        S.__sust_por_rango.push({hotel, desde: x.desde, hasta: x.hasta, titular, sustituto, motivo});
      }
    });

    // Extra: detectar sustituciones por día en filas sueltas (como en tu hoja)
    rows.forEach(r=>{
      const hotel = r.hotel || r.Hotel || r.establecimiento || r.Establecimiento;
      const fecha = r.fecha || r.Fecha || r.date || r.dia || r.day;
      const titular = r.titular || r.Titular || r.empleado || r.Empleado || r.C || r.ColC || r['Col C'];
      const sustituto = r.sustituto || r.Sustituto || r['sustituto '] || r.D || r.ColD || r['Col D'];
      const motivo = r.motivo || r.Motivo || r['C/T'] || r.ct || r.Comentario || r.Observaciones || r.observaciones;
      // heurística: fila de sustitución si hay hotel+fecha y (titular y sustituto)
      if (hotel && fecha && titular && sustituto){
        S.__sust_por_dia.push({hotel, fecha: iso(fecha), titular, sustituto, motivo: asText(motivo)});
      }
    });

    return S;
  }
  const SRC = pickSource();

  // Index de sustituciones por día
  function buildSustDiaIndex() {
    const map = new Map(); // key: hotel|fecha|titular => {sustituto,motivo}
    (SRC.__sust_por_dia||[]).forEach(s=>{
      const key = `${norm(s.hotel)}|${iso(s.fecha)}|${s.titular}`;
      map.set(key, {sustituto:s.sustituto, motivo: asText(s.motivo||"")});
    });
    return map;
  }
  // Index de sustituciones por rango (aplican si cubre toda la semana)
  function buildSustRangoIndex(hotel, monISO){
    const wk = weekDays(monISO);
    const inRange=(d,a,b)=>{ const x=toDate(d).getTime(), A=a?toDate(a).getTime():-Infinity, B=b?toDate(b).getTime():Infinity; return x>=A && x<=B; };
    const rel = (SRC.__sust_por_rango||[]).filter(s=>norm(s.hotel)===norm(hotel));
    const map = new Map(); // titular -> {sustituto,motivo}
    rel.forEach(s=>{
      const covers = wk.every(d => inRange(d, s.desde, s.hasta));
      if (covers) map.set(s.titular, {sustituto:s.sustituto, motivo: asText(s.motivo||"")});
    });
    return map;
  }

  // ---------- UI / Estado ----------
  // IDs robustos (por si cambian)
  function q(id, altSel){
    return document.getElementById(id) || (altSel ? document.querySelector(altSel) : null);
  }
  const UI = {
    app:   q("app", "#app"),
    hotel: q("hotelSelect", "#hotel, #hotelFiltro, select[name='hotel']"),
    emp:   q("employeeFilter", "#empleado, #employee, select[name='empleado']"),
    from:  q("dateFrom", "#desde, input[name='desde']"),
    to:    q("dateTo", "#hasta, input[name='hasta']"),
    prev:  q("btnPrev", "[data-nav='prev']"),
    next:  q("btnNext", "[data-nav='next']"),
    today: q("btnToday", "[data-nav='today']")
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

    // Abrir diálogo Filtros aunque cambie el botón
    const btnFilters = q("btnFilters", "button:has(svg), button:contains('Filtros'), [data-open='filters']");
    btnFilters?.addEventListener("click", () => document.querySelector("dialog")?.showModal());
    document.getElementById("btnApply")?.addEventListener("click", e=>{ e.preventDefault(); applyFilters(); document.querySelector("dialog")?.close(); });
  }
  function applyFilters(){
    STATE.hotel = UI.hotel?.value || "";
    STATE.emp   = UI.emp?.value   || "";
    STATE.from  = UI.from?.value  || "";
    STATE.to    = UI.to?.value    || "";
    render();
  }

  // Semanas + navegación robusta
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

  // ---------- Render ----------
  function render(){
    const root = UI.app; if (!root) return;
    root.innerHTML = "";

    if (!SRC.schedule.length){
      const p=document.createElement("p"); p.className="meta"; p.textContent="Listo. Abre Filtros, elige Hotel/Rango y pulsa Aplicar."; root.appendChild(p);
      return;
    }

    initFilters(); snapCursor();

    // Agrupar por semana (filtrando hotel si procede)
    const byWeek = new Map();
    for (const s of SRC.schedule){
      if (STATE.hotel && s.hotel!==STATE.hotel) continue;
      if (!byWeek.has(s.semana_lunes)) byWeek.set(s.semana_lunes, []);
      byWeek.get(s.semana_lunes).push(s);
    }

    const targetWeek = STATE.weekCursor;
    const items = (byWeek.get(targetWeek)||[]).sort((a,b)=>norm(a.hotel).localeCompare(norm(b.hotel)));

    const section = document.createElement("section");
    section.className="week-group";
    root.appendChild(section);

    // Índices de sustituciones (uno general por día y uno por rango por hotel/semana)
    const sustDiaIdx = buildSustDiaIndex();

    for (const sem of items){
      const {hotel, semana_lunes, orden_empleados=[], turnos=[]} = sem;
      const dias = weekDays(semana_lunes);
      const logo = /cumbria/i.test(hotel) ? "cumbria logo.jpg"
                  : /guadiana/i.test(hotel) ? "guadiana logo.jpg" : "icons/icon-192.png";

      // índice turnos
      const idx = new Map();
      for (const t of turnos){
        const f = iso(t.fecha || t.date || t.dia);
        idx.set(`${t.empleado}__${f}`, asText(t.turno || t.TipoAusencia || t.shift || t.tramo || t));
      }

      // Sustituciones por rango (para mover posiciones si el titular está off toda la semana)
      const sustRango = buildSustRangoIndex(hotel, semana_lunes);

      // Detectar ausentes toda la semana
      const aus = new Set();
      for (const emp of orden_empleados){
        const allOff = dias.every(d=>{
          const n = normalizeTurno(idx.get(`${emp}__${d}`) || "");
          return n.label==="—"||n.label==="Descanso"||n.label==="Vacaciones"||n.label==="Baja";
        });
        if (allOff) aus.add(emp);
      }

      // Orden final: si el titular está ausente toda la semana y hay sustitución por rango, el sustituto ocupa su lugar
      const ordenFinal = [];
      for (const emp of orden_empleados){
        if (aus.has(emp) && sustRango.has(emp)){
          const sub = sustRango.get(emp).sustituto;
          ordenFinal.push({emp: sub, mark:`↔ ${emp}`, motivoR: sustRango.get(emp).motivo || ""});
        } else if (!aus.has(emp)) {
          ordenFinal.push({emp, mark:""});
        }
      }
      // Ausentes (toda la semana) al final
      orden_empleados.forEach(e=>{ if (aus.has(e)) ordenFinal.push({emp:e, mark:""}); });

      // Filtro de empleado
      const filas = STATE.emp ? ordenFinal.filter(x=>x.emp===STATE.emp) : ordenFinal;

      // ---- Card por hotel ----
      const card = document.createElement("article"); card.className="row-card week"; section.appendChild(card);

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

      function getSustitucionDia(emp, dISO){
        const key = `${norm(hotel)}|${dISO}|${emp}`;
        const rec = sustDiaIdx.get(key);
        return rec ? { sustituto: rec.sustituto, motivo: rec.motivo } : null;
      }
      function turnoOf(emp,dISO){
        // prioridad: si hay sustitución por día para el TITULAR emp → mostramos al sustituto (hereda turno del titular)
        const sDia = getSustitucionDia(emp, dISO);
        if (sDia){
          const rawTit = idx.get(`${emp}__${dISO}`) || "";
          // devolvemos el turno del titular pero marcando sustitución
          return { raw: rawTit, sustituto: sDia.sustituto, motivo: sDia.motivo };
        }
        // si emp es sustituto por rango (ocupa lugar), hereda del titular cuando no tiene turno propio
        const titular = [...sustRango.entries()].find(([tit,info]) => info.sustituto===emp)?.[0];
        const raw = idx.get(`${emp}__${dISO}`);
        if (raw) return { raw };
        if (titular){ return { raw: idx.get(`${titular}__${dISO}`) || "" }; }
        return { raw: "" };
      }

      for (const {emp, mark, motivoR} of filas){
        const tr = document.createElement("tr");
        const name = document.createElement("td");
        name.style.textAlign="left";
        name.textContent = emp + (mark?`  ${mark}`:"");
        tr.appendChild(name);

        for (const d of dias){
          const td=document.createElement("td");
          const info = turnoOf(emp, d);
          const n = normalizeTurno(info.raw);
          if (n.label==="—"){
            td.textContent="—";
          } else {
            const wrap = document.createElement("div");
            wrap.style.display="flex"; wrap.style.flexDirection="column"; wrap.style.alignItems="center"; wrap.style.gap="4px";
            const span=document.createElement("span"); span.className=`pill ${n.cls}`; span.textContent=n.label;
            wrap.appendChild(span);

            // Etiqueta de motivo (por día o por rango)
            const motivo = info.motivo || motivoR || "";
            if (motivo){
              const badge = document.createElement("small");
              badge.className = "badge-motivo";
              badge.textContent = asText(motivo);
              wrap.appendChild(badge);
            }
            // Marcar ↔ cuando aplica sustitución por día
            if (info.sustituto) {
              span.textContent = `${span.textContent} ↔`;
            }
            td.appendChild(wrap);
          }
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
      }

      tbl.appendChild(tbody);
      card.appendChild(tbl);
    }

    // Maquetación de cards
    const cards = [...root.querySelectorAll(".week")];
    if (cards.length){
      const wrap=document.createElement("div"); wrap.className="weeks-grid";
      cards.forEach(c=>wrap.appendChild(c));
      root.innerHTML=""; root.appendChild(wrap);
    }
  }

  document.addEventListener("DOMContentLoaded", ()=>{ initFilters(); render(); });
})();
