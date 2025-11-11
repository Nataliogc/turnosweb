/* mobile.app.js (Versión móvil independiente)
   - NO registra service worker (compatible con file:// y GitHub Pages)
   - Reutiliza window.FULL_DATA generado por index/live
   - Píldoras: Descanso rojo, Noche gris con 🌙, resto amarilla suave
   - Oculta empleados sin turnos en toda la semana
*/
(function(){
  const $ = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

  // Utilidades de fechas
  const pad = n => String(n).padStart(2,'0');
  const fmt = d => `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${String(d.getFullYear()).slice(-2)}`;
  const weekdayShort = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  function getLabel(turno){
    
    if(turno == null) return "";
    // Si ya es string, normaliza
    if(typeof turno === "string"){
      return (window.MobilePatch ? window.MobilePatch.normalize(turno) : turno);
    }
    // Si viene como objeto (p.ej., {texto:'Mañana', icon:'🔄'})
    if(typeof turno === "object"){
      const candidate = turno.texto || turno.label || turno.name || turno.turno || turno.t || "";
      return (window.MobilePatch ? window.MobilePatch.normalize(String(candidate)) : String(candidate));
    }
    // Fallback genérico
    return String(turno);
  }

  function getFlag(item){
    // Devuelve {type:'swap'|'sub', symbol:'🔄'|'↔', title:string} o null
    try{
      const raw = item && item.turno;
      const text = getLabel(raw).toLowerCase();
      // Por texto
      if(text.includes('sustit')) return {type:'sub', symbol:'↔', title:'Sustitución'};
      if(text.includes('cambio') || text.includes('🔄')) return {type:'swap', symbol:'🔄', title:'Cambio de turno'};
      // Por propiedades en objeto
      if(raw && typeof raw==='object'){
        const keys = Object.keys(raw).map(k=>k.toLowerCase());
        if(keys.some(k=>k.includes('sustit'))) return {type:'sub', symbol:'↔', title:'Sustitución'};
        if(keys.some(k=>k.includes('cambio')||k.includes('swap'))) return {type:'swap', symbol:'🔄', title:'Cambio de turno'};
        if(raw.esSustituto || raw.sustituto) return {type:'sub', symbol:'↔', title:'Sustitución'};
        if(raw.cambio===true) return {type:'swap', symbol:'🔄', title:'Cambio de turno'};
      }
    }catch(e){}
    return null;
  }


  function mondayOf(date){
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = (d.getUTCDay()+6)%7; // 0=Lunes
    d.setUTCDate(d.getUTCDate()-day);
    return d;
  }
  function addDays(d, n){
    const x = new Date(d); x.setUTCDate(x.getUTCDate()+n); return x;
  }
  function toISODateUTC(d){ return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`; }

  // ==== Carga desde CSV (fallback si no hay FULL_DATA) ====
  async function fetchText(url){
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error('No se pudo cargar '+url);
    return await res.text();
  }
  function parseCSV(text){
    // Parser sencillo compatible con comillas y separador coma/; detecta separador automáticamente.
    const sep = (text.indexOf(';')>-1 && (text.split(';').length>text.split(',').length)) ? ';' : ',';
    const rows = [];
    let i=0, cur='', inQ=false;
    const push = (arr, v)=>{ arr.push(v); };
    const lineEnd = (out, row)=>{ if(row.length){ out.push(row); } };
    let row=[];
    while(i<text.length){
      const ch = text[i];
      if(ch === '"'){ if(inQ && text[i+1] === '"'){ cur+='"'; i++; } else { inQ=!inQ; } }
      else if(ch === '\n' && !inQ){ push(row, cur); rows.push(row); row=[]; cur=''; }
      else if(ch === '\r' && !inQ){ /* ignore */ }
      else if(ch === sep && !inQ){ push(row, cur); cur=''; }
      else { cur+=ch; }
      i++;
    }
    if(cur.length || row.length){ push(row, cur); rows.push(row); }
    const headers = rows.shift().map(h=>h.trim().toLowerCase());
    return rows.map(r => {
      const o={};
      for(let j=0;j<headers.length;j++){
        const key = headers[j];
        o[key] = (window.MobilePatch ? MobilePatch.normalize(r[j]??'') : (r[j]??''));
      }
      return o;
    });
  }
  function alias(o, keys){ for(const k of keys){ if(o[k]!=null && String(o[k]).trim()!=='') return o[k]; } return ''; }
  function buildFullDataFromRows(rows){
    // Esperados (con alias): hotel, semana_lunes, empleado, fecha, turno
    const items = rows.map(r=>{
      return {
        hotel: alias(r, ['hotel','propiedad','establecimiento']),
        semana_lunes: alias(r, ['semana_lunes','semana','lunes_semana','week_monday']),
        empleado: alias(r, ['empleado','trabajador','persona','colaborador','nombre']),
        fecha: alias(r, ['fecha','day','dia','día']),
        turno: (function(){
          const t = alias(r, ['turno','shift','tipo','concepto']);
          return t || r.turno || '';
        })()
      };
    }).filter(x=>x.hotel && x.semana_lunes && x.empleado && x.fecha);

    const key = (h,w)=>`${h}||${w}`;
    const buckets = new Map();
    for(const it of items){
      const k = key(it.hotel, it.semana_lunes);
      if(!buckets.has(k)){
        buckets.set(k, { hotel: it.hotel, semana_lunes: it.semana_lunes, orden_empleados: [], turnos: [] });
      }
      const b = buckets.get(k);
      if(!b.orden_empleados.includes(it.empleado)) b.orden_empleados.push(it.empleado);
      b.turnos.push({ empleado: it.empleado, fecha: it.fecha, turno: it.turno });
    }
    return { schedule: Array.from(buckets.values()) };
  }
  async function loadDataOrCSV(){
    // 1) Si existe window.FULL_DATA usable, devolverlo
    if(window.FULL_DATA && Array.isArray(window.FULL_DATA.schedule) && window.FULL_DATA.schedule.length){
      return window.FULL_DATA;
    }
    // 2) Intentar cargar CSV en ./data/turnos.csv (y opcional ./data/turnos_*.csv)
    try{
      let txt = await fetchText('data/turnos.csv');
      let rows = parseCSV(txt);
      // Merge adicionales si existen
      for(const extra of ['data/turnos_extra.csv','data/turnos2.csv']){
        try{ const t2 = await fetchText(extra); rows = rows.concat(parseCSV(t2)); }catch(e){/* opcional */}
      }
      const full = buildFullDataFromRows(rows);
      window.FULL_DATA = full; // para reutilizar
      return full;
    }catch(err){
      console.warn('CSV no disponible:', err);
      return {schedule: []};
    }
  }


  // DOM
  const weekPicker = $("#weekPicker");
  const hotelSelect = $("#hotelSelect");
  const refreshBtn = $("#refreshBtn");
  const prevWeekBtn = $("#prevWeekBtn");
  const todayBtn = $("#todayBtn");
  const nextWeekBtn = $("#nextWeekBtn");
  const thead = $("#thead");
  const tbody = $("#tbody");
  const singleCard = $("#singleCard");
  const multi = $("#multi");
  const hotelTitle = $("#hotelTitle");
  const hotelLogo = $("#hotelLogo");

  // Cargar lista de hoteles del FULL_DATA

  let DATA = [];
  (async ()=>{
    const full = await loadDataOrCSV();
    DATA = full.schedule || [];
    const HOTELS = Array.from(new Set(DATA.map(s => s.hotel))).sort();
    hotelSelect.innerHTML = [`<option value="__ALL__">Todos</option>`, ...HOTELS.map(h => `<option value="${h}">${h}</option>`)].join("");
    // Por defecto: lunes de hoy
    const monday = mondayOf(new Date());
    weekPicker.value = toISODateUTC(monday);
    // Seleccionar primer hotel si no hay valor previo
    if(!hotelSelect.value) hotelSelect.value = "__ALL__";
    refresh();
  })();

  // Logo según hotel (rutas relativas dentro de img/)
  function logoFor(hotel){
    const h = (hotel||"").toLowerCase();
    if(h.includes("guadiana")) return "img/guadiana.png";
    if(h.includes("cumbria")) return "img/cumbria.png";
    return "img/logo.png";
  }

  // Render cabecera días
  function renderHeader(monday){
    thead.innerHTML = [
      `<div class="th"></div>`,
      ...[0,1,2,3,4,5,6].map(i=>{
        const d = addDays(monday,i);
        return `<div class="th">
          <div class="weekday">
            <span class="name">${weekdayShort[i]}</span>
            <span class="date">${d.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'2-digit'})}</span>
          </div>
        </div>`;
      })
    ].join("");
  }

  // Render filas
  
  function renderHotelSection(hotel, monday){
    const sec = document.createElement('section');
    sec.className = 'hotel-section';
    // Header
    const hdr = document.createElement('div');
    hdr.className = 'hotel-hdr';
    const img = document.createElement('img');
    img.src = logoFor(hotel); img.alt = 'Logo '+hotel; img.onerror = ()=>{ img.src = 'img/logo.png'; };
    const nm = document.createElement('div');
    nm.className = 'hotel-name';
    nm.textContent = hotel;
    hdr.appendChild(img); hdr.appendChild(nm);
    // Table
    const card = document.createElement('section');
    card.className = 'card';
    const th = document.createElement('div'); th.className = 'thead';
    const tb = document.createElement('div'); tb.id = ''; // not needed
    tb.className = '';
    card.appendChild(th); card.appendChild(tb);
    sec.appendChild(hdr); sec.appendChild(card);
    // Build header and body
    th.innerHTML = [
      `<div class="th"></div>`,
      ...[0,1,2,3,4,5,6].map(i=>{
        const d = addDays(monday,i);
        return `<div class="th"><div class="weekday"><span class="name">${weekdayShort[i]}</span><span class="date">${d.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'2-digit'})}</span></div></div>`;
      })
    ].join("");
    const weekData = window.MobileAdapter.buildWeekData(window.FULL_DATA || {schedule: DATA}, hotel, monday);
    // Build body rows (reuse render logic)
    const frag = document.createDocumentFragment();
    weekData.empleados.forEach(emp => {
      const row = document.createElement("div");
      row.className = "row";
      const name = document.createElement("div");
      name.className = "cell-name";
      name.textContent = (window.MobilePatch? window.MobilePatch.normalize(emp) : emp);
      row.appendChild(name);
      for(let i=0;i<7;i++){
        const dkey = toISODateUTC(addDays(weekData.monday,i));
        const item = (weekData.turnosByEmpleado[emp] && weekData.turnosByEmpleado[emp][dkey]) || null;
        const cell = document.createElement("div");
        cell.className = "cell";
        if(item){
          const pill = document.createElement("span");
          pill.className = "pill";
          let label = getLabel(item.turno);
          const low = label.toLowerCase();
          if(low.includes("descanso")){ pill.classList.add("descanso"); label = "Descanso"; }
          else if(low.includes("noche")){ pill.classList.add("noche"); label = "🌙 Noche"; }
          else if(low.includes("mañana")){ pill.classList.add("manana"); label = "Mañana"; }
          else if(low.includes("tarde")){ pill.classList.add("tarde"); label = "Tarde"; }
          else if(low.includes("vacaciones")){ pill.classList.add("vac"); label = "Vacaciones 🏖️"; }
          else { pill.classList.add("vac"); }
          pill.textContent = label;
          const flag = getFlag(item);
          if(flag){
            const b = document.createElement('span');
            b.className = 'badge';
            b.title = flag.title;
            b.textContent = flag.symbol;
            pill.appendChild(b);
          }
          cell.appendChild(pill);
        }
        row.appendChild(cell);
      }
      frag.appendChild(row);
    });
    // Attach frag to a tbody-like container
    const tbodyLike = document.createElement('div');
    tbodyLike.id = '';
    card.appendChild(tbodyLike);
    card.replaceChild(tbodyLike, card.lastChild);
    tbodyLike.appendChild(frag);
    return sec;
  }

  function renderBody(weekData){
    tbody.innerHTML = "";
    const empleados = weekData.empleados;
    empleados.forEach(emp => {
      const row = document.createElement("div");
      row.className = "row";
      const name = document.createElement("div");
      name.className = "cell-name";
      name.textContent = (window.MobilePatch? window.MobilePatch.normalize(emp) : emp);
      row.appendChild(name);
      for(let i=0;i<7;i++){
        const dkey = toISODateUTC(addDays(weekData.monday,i));
        const item = (weekData.turnosByEmpleado[emp] && weekData.turnosByEmpleado[emp][dkey]) || null;
        const cell = document.createElement("div");
        cell.className = "cell";
        if(item){
          const pill = document.createElement("span");
          pill.className = "pill";
          let label = getLabel(item.turno);
          const low = label.toLowerCase();
          // Clasificación por tipo para igualar colores del index
          if(low.includes("descanso")){ pill.classList.add("descanso"); label = "Descanso"; }
          else if(low.includes("noche")){ pill.classList.add("noche"); label = "🌙 Noche"; }
          else if(low.includes("mañana")){ pill.classList.add("manana"); label = "Mañana"; }
          else if(low.includes("tarde")){ pill.classList.add("tarde"); label = "Tarde"; }
          else if(low.includes("vacaciones")){ pill.classList.add("vac"); label = "Vacaciones 🏖️"; }
          else { pill.classList.add("vac"); } // por defecto, arena suave
          pill.textContent = label;
          const flag = getFlag(item);
          if(flag){
            const b = document.createElement('span');
            b.className = 'badge';
            b.title = flag.title;
            b.textContent = flag.symbol;
            pill.appendChild(b);
          }
          cell.appendChild(pill);
        }
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    });
  }

  function refresh(){
    const prevScrollY = window.scrollY || document.documentElement.scrollTop || 0;
    const hotel = hotelSelect.value;
    const monday = new Date(weekPicker.value);
    hotelTitle.textContent = (window.MobilePatch? window.MobilePatch.normalize(hotel):hotel);
    hotelLogo.src = logoFor(hotel);
    hotelLogo.onerror = ()=>{ hotelLogo.src = 'img/logo.png'; };
    window.requestAnimationFrame(()=>{ renderHeader(monday); const weekData = window.MobileAdapter.buildWeekData(window.FULL_DATA, hotel, monday); renderBody(weekData); });
    // restaurar scroll
    setTimeout(()=>window.scrollTo({top:prevScrollY,left:0,behavior:'instant'}),0);
  }

  let refreshTimer; refreshBtn.addEventListener("click", ()=>{ clearTimeout(refreshTimer); refreshTimer=setTimeout(refresh, 50); });
  hotelSelect.addEventListener("change", refresh);
  weekPicker.addEventListener("change", refresh);

  // Flatpickr si está disponible en el proyecto (opcional, no requerido)
  if(window.flatpickr){
    flatpickr(weekPicker, {
      dateFormat: "Y-m-d",
      defaultDate: weekPicker.value,
      locale: "es",
      weekNumbers: true,
      allowInput: true
    });
  }

  
  // Navegación de semanas
  function setWeekByOffset(offsetDays){
    const d = new Date(weekPicker.value);
    d.setUTCDate(d.getUTCDate()+offsetDays);
    const monday = (function(x){ const dt=new Date(x); const day=(dt.getUTCDay()+6)%7; dt.setUTCDate(dt.getUTCDate()-day); return dt; })(d);
    weekPicker.value = toISODateUTC(monday);
    refresh();
  }
  prevWeekBtn && prevWeekBtn.addEventListener('click', ()=> setWeekByOffset(-7));
  todayBtn && todayBtn.addEventListener('click', ()=> { weekPicker.value = toISODateUTC(mondayOf(new Date())); refresh(); });
  nextWeekBtn && nextWeekBtn.addEventListener('click', ()=> setWeekByOffset(7));

  // Primera carga
  refresh();
})();
