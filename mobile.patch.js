/* Turnos Web · mobile.patch.js (móvil)
   - Render de semanas
   - Navegación ← Hoy →
   - Emojis canónicos y limpieza de mojibake
   - Oculta filas totalmente vacías
   - Sustituciones: el sustituto ocupa la posición (vacaciones/baja toda semana al final)
   - Filtros + Flatpickr fallback a <input type="date"> si la CDN no carga
*/
(function () {
  "use strict";
  const $ = (s, ctx=document) => ctx.querySelector(s);
  const DAY = 86400000;

  // ======= Limpieza unicode =======
  function fix(s){
    if(typeof s!=="string") return s;
    const map = [
      [/Ã¡/g,"á"],[/Ã©/g,"é"],[/Ã­/g,"í"],[/Ã³/g,"ó"],[/Ãº/g,"ú"],
      [/Ã±/g,"ñ"],[/Ã‘/g,"Ñ"],[/Ã¼/g,"ü"],[/Â¿/g,"¿"],[/Â¡/g,"¡"],
      [/Âº/g,"º"],[/Âª/g,"ª"],[/Â·/g,"·"]
    ];
    let out=s; for(const [re,r] of map) out=out.replace(re,r);
    out = out.replace(/[\u0000-\u001F\u007F-\u009F]/g,"");      // controles (incluye U+009F)
    out = out.replace(/ð[\u0080-\u00FF\-–—”“"'\u00A0-\u00FF]*/g,"")
             .replace(/Â[\u0080-\u00FF\-–—”“"'\u00A0-\u00FF]*/g,"")
             .replace(/ï¸[\u0080-\u00FF\-–—”“"'\u00A0-\u00FF]*/g,"")
             .replace(/\uFFFD/g,"")
             .replace(/[Ÿ ¤’‚‹›˘]/g,"");
    return out.trim().replace(/\s{2,}/g," ");
  }

  // ======= Fechas =======
  const iso = d => { const x=new Date(d); x.setHours(0,0,0,0);
    return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`; };
  const fromISO = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
  const monday = d => { const x=new Date(d); const w=(x.getDay()+6)%7; x.setDate(x.getDate()-w); x.setHours(0,0,0,0); return x; };
  const weekDays = mon => Array.from({length:7},(_,i)=>iso(new Date(mon.getTime()+i*DAY)));
  const mini = s => { const dt=fromISO(s);
    return dt.toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"2-digit"}).toLowerCase(); };

  // ======= Datos =======
  const DATA = window.FULL_DATA || window.DATA || {};
  const SCHEDULE = Array.isArray(DATA.schedule) ? DATA.schedule : [];
  const WEEKS = [...new Set(SCHEDULE.map(g=>g.semana_lunes))].sort();
  const byWeekHotel = new Map();
  for (const g of SCHEDULE) byWeekHotel.set(g.semana_lunes + "||" + g.hotel, g);
  const state = { weekISO: nearestWeek() };

  function nearestWeek(ref=new Date()){
    if(!WEEKS.length) return iso(monday(ref));
    const t=monday(ref).getTime();
    return WEEKS.map(w=>[w,Math.abs(fromISO(w).getTime()-t)]).sort((a,b)=>a[1]-b[1])[0][0];
  }

  // ======= Etiquetas & emojis =======
  const rawLabel = (v)=>{
    if(v==null) return "";
    if(typeof v==="string") return fix(v);
    return fix(v.TipoInterpretado || v.TipoAusencia || v.TurnoOriginal || "");
  };
  function withEmoji(label){
    let out=(label||"").trim();
    const low=out.toLowerCase();
    const change = /(↔|→|←|->|=>|c\/?t|\bct\b|cambio( de turno)?)/i;
    if(/vacaciones/.test(low) && !/🏖️/.test(out)) out+=" 🏖️";
    if(/baja/.test(low)       && !/🤒/.test(out)) out+=" 🤒";
    if(/permiso/.test(low)    && !/🗓️/.test(out)) out+=" 🗓️";
    if(/formaci[oó]n/.test(low) && !/🎓/.test(out)) out+=" 🎓";
    if(/(^|\s)noche(\s|$)/i.test(out) && !/🌙/.test(out)) out+=" 🌙";
    if(change.test(out) && !/🔄/.test(out)) out+=" 🔄";
    // limpiar restos raros
    out = out.replace(/[↔→←”“„]/g,"").trim().replace(/\s{2,}/g," ");
    return out;
  }

  // ======= Grid & sustitutos =======
  function buildGrid(group, days){
    const grid={}, meta={}, subCount={};
    const all = new Set(group.orden_empleados || []);
    (group.turnos||[]).forEach(t=>{ const s=t?.turno?.Sustituto; if(s) all.add(s); });
    all.forEach(e=>{ grid[e]={}; meta[e]={}; days.forEach(d=>{grid[e][d]=""; meta[e][d]=null;}); });

    (group.turnos||[]).forEach(t=>{ if(grid[t.empleado]) grid[t.empleado][t.fecha]=t.turno; });

    for(const emp of Object.keys(grid)){
      for(const d of days){
        const v = grid[emp][d];
        if(v && typeof v==="object"){
          const lab = rawLabel(v);
          grid[emp][d]=lab; meta[emp][d]={isAbsence:true, sub:v.Sustituto||null};
          const su=v.Sustituto;
          if(su){
            subCount[emp]=subCount[emp]||{}; subCount[emp][su]=(subCount[emp][su]||0)+1;
            const heredado = rawLabel({TurnoOriginal:v.TurnoOriginal});
            if(!grid[su]){ grid[su]={}; meta[su]={}; days.forEach(x=>{grid[su][x]=""; meta[su][x]=null;}); }
            grid[su][d]=heredado; meta[su][d]={isSub:true, for:emp};
          }
        }else if(typeof v==="string"){
          grid[emp][d]=fix(v);
        }
      }
    }

    const weekEmpty=new Set(), weekAbsent=new Set();
    (group.orden_empleados||[]).forEach(emp=>{
      let onlyDash=true, onlyAbs=true;
      days.forEach(d=>{
        const val=(grid[emp][d]||"").trim();
        const low=val.toLowerCase();
        const isDash = val==="" || val==="—" || val==="-";
        const isAbs  = /vacac|baja|permiso|formaci|descanso/.test(low);
        if(!isDash) onlyDash=false;
        if(!isAbs)  onlyAbs=false;
      });
      if(onlyDash) weekEmpty.add(emp);
      else if(onlyAbs) weekAbsent.add(emp);
    });

    const mainSub={};
    for(const emp of Object.keys(subCount)){
      const arr = Object.entries(subCount[emp]).sort((a,b)=>b[1]-a[1]);
      if(arr.length) mainSub[emp]=arr[0][0];
    }

    return {grid, meta, weekEmpty, weekAbsent, mainSub};
  }

  // ======= Render =======
  function render(){
    const app=$("#app"); if(!app) return;
    app.innerHTML="";

    if(!SCHEDULE.length){ app.innerHTML=`<p class="meta">Sin datos.</p>`; return; }
    const days = weekDays(fromISO(state.weekISO));
    app.insertAdjacentHTML("beforeend", `<p class="meta">Semana ${mini(days[0])} → ${mini(days[6])}</p>`);

    const f = window.__TW_STATE__?.filters || {};
    let hotels=[...new Set(SCHEDULE.map(g=>g.hotel))];
    if(f.hotel) hotels=hotels.filter(h=>h===f.hotel);

    hotels.forEach(hotel=>{
      const g = byWeekHotel.get(state.weekISO+"||"+hotel);
      if(!g) return;

      const {grid,meta,weekEmpty,weekAbsent,mainSub}=buildGrid(g,days);

      const base=[...(g.orden_empleados||[])];
      const visibles = base.filter(e=>!weekEmpty.has(e));
      const present  = visibles.filter(e=>!weekAbsent.has(e));
      const absent   = visibles.filter(e=> weekAbsent.has(e));

      const order=[]; const used=new Set();
      present.forEach(e=>{ if(!used.has(e)){order.push(e); used.add(e);} });
      base.forEach(e=>{
        if(weekAbsent.has(e)){
          const su=mainSub[e];
          if(su && !used.has(su)){ order.push(su); used.add(su); }
        }
      });
      absent.forEach(e=>{ if(!used.has(e)){ order.push(e); used.add(e);} });

      let list = order;
      if(f.empleado) list = list.filter(x=>x===f.empleado);
      if(!list.length) return;

      const card=document.createElement("section");
      card.className="week";
      const logo = /cumbria/i.test(hotel) ? "cumbria%20logo.jpg"
                 : /guadiana/i.test(hotel) ? "guadiana%20logo.jpg" : "Logo.png";

      card.innerHTML=`
        <div class="week-head" style="display:flex;gap:.75rem;align-items:center;padding:.85rem 1rem;border-bottom:1px solid #eef2f7">
          <img src="${logo}" onerror="this.src='Logo.png'" style="width:32px;height:32px;border-radius:8px;object-fit:cover">
          <div>
            <div style="font-weight:700">${fix(hotel)} – Semana ${state.weekISO}</div>
            <div style="color:#6b7280;font-size:12px">${days[0]} → ${days[6]}</div>
          </div>
        </div>
        <div class="table-container" style="overflow:auto">
          <table style="width:100%;border-collapse:separate;border-spacing:0">
            <thead>
              <tr>
                <th>Empleados</th>
                ${days.map(d=>`<th>${new Date(d+'T00:00:00').toLocaleDateString('es-ES',{weekday:'long'}).toUpperCase()}<div style="font-size:12px;color:#6b7280">${mini(d)}</div></th>`).join("")}
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>`;
      const tbody=card.querySelector("tbody");

      list.forEach(emp=>{
        const tr=document.createElement("tr");
        let row=`<td style="text-align:left">${fix(emp)}</td>`;
        days.forEach(d=>{
          let lab = withEmoji(rawLabel(grid[emp]?.[d]));
          const low=(lab||"").toLowerCase();
          let cls="";
          if (/vacaciones|baja|permiso|formaci|descanso/.test(low)) cls="background:#ffe2e2;color:#991b1b";
          else if (/noche/.test(low)) cls="background:#e6ebff;color:#1e3a8a";
          else if (/tarde/.test(low)) cls="background:#fff3c4;color:#92400e";
          else if (/mañana|manana/.test(low)) cls="background:#e7f9ec;color:#166534";
          const swap = meta[emp]?.[d]?.isSub ? " ↔" : "";
          row += `<td>${ lab ? `<span style="display:inline-block;padding:.35rem .65rem;border-radius:999px;font-weight:600;${cls}">${lab}${swap}</span>` : "—" }</td>`;
        });
        tr.innerHTML=row; tbody.appendChild(tr);
      });

      $("#app").appendChild(card);
    });
  }

  // Exponer helpers
  window.__TW_RERENDER = () => render();
  window.__TW_MOVE_TO_WEEK = (w)=>{ state.weekISO=w; render(); };
  window.__TW_MOVE_TO_NEAREST = (w)=>{
    const to=(s)=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d);};
    if(!WEEKS.length) return;
    const nearest = WEEKS.slice().sort((a,b)=>Math.abs(to(a)-to(w))-Math.abs(to(b)-to(w)))[0];
    state.weekISO=nearest; render();
  };

  // Navegación
  function move(step){
    if(!WEEKS.length) return;
    const i=Math.max(0,WEEKS.indexOf(state.weekISO));
    const j=Math.min(WEEKS.length-1, Math.max(0,i+step));
    state.weekISO=WEEKS[j]; render();
  }
  $("#btnPrev")?.addEventListener("click",()=>move(-1));
  $("#btnNext")?.addEventListener("click",()=>move(+1));
  $("#btnToday")?.addEventListener("click",()=>{ state.weekISO=nearestWeek(new Date()); render(); });

  document.addEventListener("DOMContentLoaded", render);
})();

/* ====== Filtros + fallback calendario ====== */
(function(){
  const $=(s,c=document)=>c.querySelector(s);
  const fstate = { hotel:null, empleado:null, desde:null, hasta:null };
  window.__TW_STATE__ = window.__TW_STATE__ || {};
  window.__TW_STATE__.filters = fstate;

  function parseEs(str){
    if(!str) return null;
    const s=str.trim();
    if(/^\d{6}$/.test(s)){ const dd=s.slice(0,2),mm=s.slice(2,4),aa=s.slice(4,6); return parseEs(`${dd}/${mm}/20${aa}`); }
    if(!/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return null;
    const [dd,mm,yy]=s.split("/").map(Number);
    const d=new Date(yy,mm-1,dd); d.setHours(0,0,0,0);
    return (d.getFullYear()===yy && d.getMonth()===(mm-1) && d.getDate()===dd) ? d : null;
  }

  function populate(){
    const selH=$("#fHotel"), selE=$("#fEmpleado");
    const sched=(window.FULL_DATA?.schedule || window.DATA?.schedule || []);
    const hotels=[...new Set(sched.map(g=>g.hotel))].sort((a,b)=>a.localeCompare(b,"es"));
    selH.innerHTML=`<option value="">— Hotel —</option>` + hotels.map(h=>`<option>${h}</option>`).join("");

    function fillEmp(hFilter){
      const set=new Set();
      sched.forEach(g=>{
        if(hFilter && g.hotel!==hFilter) return;
        (g.orden_empleados||[]).forEach(e=>set.add(e));
        (g.turnos||[]).forEach(t=>{ if(t?.empleado) set.add(t.empleado); const su=t?.turno?.Sustituto; if(su) set.add(su); });
      });
      const list=[...set].sort((a,b)=>a.localeCompare(b,"es"));
      selE.innerHTML=`<option value="">— Empleado —</option>` + list.map(e=>`<option>${e}</option>`).join("");
    }
    fillEmp(null);

    selH.onchange=()=>{ fstate.hotel=selH.value||null; fillEmp(fstate.hotel); selE.value=""; fstate.empleado=null; };
    selE.onchange=()=>{ fstate.empleado=selE.value||null; };
  }

  function wire(){
    const btnApply=$("#fApply"), btnClose=$("#fClose");
    const iDesde=$("#fDesde"), iHasta=$("#fHasta");
    if(!btnApply) return;

    // Fallback: si no hay Flatpickr, usa tipo date nativo
    if(!window.flatpickr){
      iDesde.setAttribute("type","date");
      iHasta.setAttribute("type","date");
    }

    btnApply.onclick=(e)=>{
      e.preventDefault();
      const d = parseEs(iDesde.type==="date" ? (iDesde.value && iDesde.value.split("-").reverse().join("/")) : iDesde.value);
      const h = parseEs(iHasta.type==="date" ? (iHasta.value && iHasta.value.split("-").reverse().join("/")) : iHasta.value);
      fstate.desde=d; fstate.hasta=h;

      if(d){
        const m=new Date(d); m.setDate(m.getDate()-((m.getDay()+6)%7)); m.setHours(0,0,0,0);
        const iso=(x)=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
        const w=iso(m);
        if(window.__TW_MOVE_TO_WEEK) __TW_MOVE_TO_WEEK(w);
        else if(window.__TW_MOVE_TO_NEAREST) __TW_MOVE_TO_NEAREST(w);
      }
      window.__TW_RERENDER && __TW_RERENDER();
      document.getElementById('dlgFilters')?.close();
    };
    btnClose.onclick=(e)=>{ e.preventDefault(); document.getElementById('dlgFilters')?.close(); };
  }

  document.addEventListener("DOMContentLoaded", ()=>{ populate(); wire(); });
})();
