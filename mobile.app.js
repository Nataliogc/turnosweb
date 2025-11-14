/* mobile.app.js (Versión móvil)
   - Sin service worker
   - Reutiliza window.FULL_DATA; si no existe, intenta CSV en data/turnos.csv
   - Hotel selector:
       · Hotel concreto → una tabla (singleCard)
       · "Todos" (__ALL__) → una tabla por hotel, una debajo de otra (multi)
*/

(function(){
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

  // ------- Utilidades de fecha -------
  const pad = n => String(n).padStart(2,'0');
  const weekdayShort = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

  function mondayOf(date){
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = (d.getUTCDay()+6)%7; // 0 = lunes
    d.setUTCDate(d.getUTCDate()-day);
    return d;
  }
  function addDays(d, n){
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate()+n);
    return x;
  }
  function toISODateUTC(d){
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
  }

  // ------- Normalización de textos -------

  function getLabel(turno){
    if(turno == null) return "";
    if(typeof turno === "string"){
      return (window.MobilePatch ? window.MobilePatch.normalize(turno) : turno);
    }
    if(typeof turno === "object"){
      const candidate = turno.texto || turno.label || turno.name || turno.turno || turno.t || "";
      return (window.MobilePatch ? window.MobilePatch.normalize(String(candidate)) : String(candidate));
    }
    return String(turno);
  }

  function getFlag(item){
    try{
      const raw  = item && item.turno;
      const text = getLabel(raw).toLowerCase();

      if(text.includes('sustit')) return {type:'sub', symbol:'↔', title:'Sustitución'};
      if(text.includes('cambio') || text.includes('🔄')) return {type:'swap', symbol:'🔄', title:'Cambio de turno'};

      if(raw && typeof raw === 'object'){
        const keys = Object.keys(raw).map(k=>k.toLowerCase());
        if(keys.some(k=>k.includes('sustit'))) return {type:'sub', symbol:'↔', title:'Sustitución'};
        if(keys.some(k=>k.includes('cambio') || k.includes('swap'))) return {type:'swap', symbol:'🔄', title:'Cambio de turno'};
        if(raw.esSustituto || raw.sustituto) return {type:'sub', symbol:'↔', title:'Sustitución'};
        if(raw.cambio === true) return {type:'swap', symbol:'🔄', title:'Cambio de turno'};
      }
    }catch(e){}
    return null;
  }

  function logoFor(hotel){
    const h = (hotel || "").toLowerCase();
    if(h.includes("guadiana")) return "img/guadiana.png";
    if(h.includes("cumbria"))  return "img/cumbria.png";
    return "img/logo.png";
  }

  // ------- Carga de datos (FULL_DATA o CSV) -------

  async function fetchText(url){
    const res = await fetch(url, {cache:'no-store'});
    if(!res.ok) throw new Error('No se pudo cargar '+url);
    return await res.text();
  }

  function parseCSV(text){
    const sep = (text.indexOf(';')>-1 && (text.split(';').length>text.split(',').length)) ? ';' : ',';
    const rows = [];
    let i=0, cur='', inQ=false, row=[];
    const push = v => row.push(v);

    while(i<text.length){
      const ch = text[i];
      if(ch === '"'){
        if(inQ && text[i+1] === '"'){ cur+='"'; i++; }
        else { inQ = !inQ; }
      }else if(ch === '\n' && !inQ){
        push(cur); rows.push(row); row=[]; cur='';
      }else if(ch === '\r' && !inQ){
        // ignore
      }else if(ch === sep && !inQ){
        push(cur); cur='';
      }else{
        cur += ch;
      }
      i++;
    }
    if(cur.length || row.length){ push(cur); rows.push(row); }

    const headers = rows.shift().map(h => h.trim().toLowerCase());
    return rows.map(r => {
      const o={};
      for(let j=0;j<headers.length;j++){
        const key = headers[j];
        const val = (r[j] ?? '');
        o[key] = (window.MobilePatch ? window.MobilePatch.normalize(val) : val);
      }
      return o;
    });
  }

  function alias(o, keys){
    for(const k of keys){
      if(o[k]!=null && String(o[k]).trim()!=='') return o[k];
    }
    return '';
  }

  function buildFullDataFromRows(rows){
    const items = rows.map(r => ({
      hotel:        alias(r, ['hotel','propiedad','establecimiento']),
      semana_lunes: alias(r, ['semana_lunes','semana','lunes_semana','week_monday']),
      empleado:     alias(r, ['empleado','trabajador','persona','colaborador','nombre']),
      fecha:        alias(r, ['fecha','day','dia','día']),
      turno: (function(){
        const t = alias(r, ['turno','shift','tipo','concepto']);
        return t || r.turno || '';
      })()
    })).filter(x => x.hotel && x.semana_lunes && x.empleado && x.fecha);

    const key = (h,w)=>`${h}||${w}`;
    const buckets = new Map();

    for(const it of items){
      const k = key(it.hotel, it.semana_lunes);
      if(!buckets.has(k)){
        buckets.set(k, {
          hotel: it.hotel,
          semana_lunes: it.semana_lunes,
          orden_empleados: [],
          turnos: []
        });
      }
      const b = buckets.get(k);
      if(!b.orden_empleados.includes(it.empleado)) b.orden_empleados.push(it.empleado);
      b.turnos.push({ empleado: it.empleado, fecha: it.fecha, turno: it.turno });
    }

    return { schedule: Array.from(buckets.values()) };
  }

  async function loadDataOrCSV(){
    // 1) FULL_DATA ya generado por index/live
    if(window.FULL_DATA && Array.isArray(window.FULL_DATA.schedule) && window.FULL_DATA.schedule.length){
      return window.FULL_DATA;
    }
    // 2) Fallback CSV
    try{
      let txt  = await fetchText('data/turnos.csv');
      let rows = parseCSV(txt);

      for(const extra of ['data/turnos_extra.csv','data/turnos2.csv']){
        try{
          const t2 = await fetchText(extra);
          rows = rows.concat(parseCSV(t2));
        }catch(e){/* opcionales */}
      }

      const full = buildFullDataFromRows(rows);
      window.FULL_DATA = full;
      return full;
    }catch(err){
      console.warn('CSV no disponible:', err);
      return {schedule: []};
    }
  }

  // ------- Renderizado -------

  const weekPicker   = $("#weekPicker");
  const hotelSelect  = $("#hotelSelect");
  const refreshBtn   = $("#refreshBtn");
  const prevWeekBtn  = $("#prevWeekBtn");
  const todayBtn     = $("#todayBtn");
  const nextWeekBtn  = $("#nextWeekBtn");
  const singleCard   = $("#singleCard");
  const multi        = $("#multi");
  const theadEl      = $("#thead");
  const tbodyEl      = $("#tbody");
  const hotelTitle   = $("#hotelTitle");
  const hotelLogo    = $("#hotelLogo");

  let FULL_DATA = {schedule: []};
  let HOTELS    = [];

  function renderHeader(thead, monday){
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

  function renderBody(tbody, weekData){
    tbody.innerHTML = "";
    const monday = weekData.monday;
    const empleados = weekData.empleados || [];

    empleados.forEach(emp => {
      const row  = document.createElement("div");
      row.className = "row";

      const name = document.createElement("div");
      name.className = "cell-name";
      name.textContent = (window.MobilePatch ? window.MobilePatch.normalize(emp) : emp);
      row.appendChild(name);

      for(let i=0;i<7;i++){
        const dkey = toISODateUTC(addDays(monday,i));
        const item = (weekData.turnosByEmpleado[emp] && weekData.turnosByEmpleado[emp][dkey]) || null;

        const cell = document.createElement("div");
        cell.className = "cell";

        if(item){
          const pill = document.createElement("span");
          pill.className = "pill";
          let label = getLabel(item.turno);
          const low  = label.toLowerCase();

          if(low.includes("descanso")){ pill.classList.add("descanso"); label = "Descanso"; }
          else if(low.includes("noche")){ pill.classList.add("noche"); label = "🌙 Noche"; }
          else if(low.includes("mañana")){ pill.classList.add("manana"); label = "Mañana"; }
          else if(low.includes("tarde")){ pill.classList.add("tarde"); label = "Tarde"; }
          else if(low.includes("vacaciones")){ pill.classList.add("vac"); label = "Vacaciones 🏖️"; }
          else { pill.classList.add("vac"); }

          pill.textContent = label;

          const flag = getFlag(item);
          if(flag){
            const b = document.createElement("span");
            b.className = "badge";
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

  // Render para un solo hotel (singleCard)
  function renderSingleHotel(hotel, monday){
    const weekData = window.MobileAdapter.buildWeekData(FULL_DATA, hotel, monday);
    const baseMonday = weekData.monday || monday;
    renderHeader(theadEl, baseMonday);
    renderBody(tbodyEl, weekData);
  }

  // Render para TODOS los hoteles (multi)
  function renderAllHotels(monday){
    multi.innerHTML = "";

    HOTELS.forEach(hotel => {
      const weekData = window.MobileAdapter.buildWeekData(FULL_DATA, hotel, monday);
      const baseMonday = weekData.monday || monday;

      const section = document.createElement("section");
      section.className = "hotel-section";

      const hdr = document.createElement("div");
      hdr.className = "hotel-hdr";
      const img = document.createElement("img");
      img.src = logoFor(hotel);
      img.alt = "Logo " + hotel;
      img.onerror = ()=>{ img.src = "img/logo.png"; };
      const nm  = document.createElement("div");
      nm.className = "hotel-name";
      nm.textContent = (window.MobilePatch ? window.MobilePatch.normalize(hotel) : hotel);
      hdr.appendChild(img);
      hdr.appendChild(nm);

      const card = document.createElement("section");
      card.className = "card";

      const th = document.createElement("div");
      th.className = "thead";
      const tb = document.createElement("div");
      tb.className = "tbody";

      card.appendChild(th);
      card.appendChild(tb);

      section.appendChild(hdr);
      section.appendChild(card);
      multi.appendChild(section);

      renderHeader(th, baseMonday);
      renderBody(tb, weekData);
    });
  }

  // ------- Refresh global -------

  function refresh(){
    if(!weekPicker.value){
      const mondayToday = mondayOf(new Date());
      weekPicker.value = toISODateUTC(mondayToday);
    }

    const hotelVal = hotelSelect.value || "__ALL__";
    const monday   = new Date(weekPicker.value + "T00:00:00");

    // Marca visual de cabecera
    if(hotelVal === "__ALL__"){
      hotelTitle.textContent = "Todos los hoteles";
      hotelLogo.src = "img/logo.png";
    }else{
      hotelTitle.textContent = (window.MobilePatch ? window.MobilePatch.normalize(hotelVal) : hotelVal);
      hotelLogo.src = logoFor(hotelVal);
    }
    hotelLogo.onerror = ()=>{ hotelLogo.src = "img/logo.png"; };

    // Modo de renderizado
    if(hotelVal === "__ALL__"){
      singleCard.style.display = "none";
      multi.style.display      = "block";
      renderAllHotels(monday);
    }else{
      multi.style.display      = "none";
      singleCard.style.display = "block";
      renderSingleHotel(hotelVal, monday);
    }
  }

  // ------- Eventos -------

  let refreshTimer;
  refreshBtn.addEventListener("click", ()=>{
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 50);
  });

  hotelSelect.addEventListener("change", refresh);
  weekPicker.addEventListener("change", refresh);

  function setWeekByOffset(offsetDays){
    const d = weekPicker.value ? new Date(weekPicker.value+"T00:00:00") : mondayOf(new Date());
    d.setUTCDate(d.getUTCDate()+offsetDays);
    const monday = mondayOf(d);
    weekPicker.value = toISODateUTC(monday);
    refresh();
  }

  prevWeekBtn && prevWeekBtn.addEventListener("click", ()=> setWeekByOffset(-7));
  todayBtn   && todayBtn.addEventListener("click", ()=> {
    weekPicker.value = toISODateUTC(mondayOf(new Date()));
    refresh();
  });
  nextWeekBtn && nextWeekBtn.addEventListener("click", ()=> setWeekByOffset(7));

  // Corrige altura viewport móvil
  function setVH(){
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  }
  window.addEventListener('resize', setVH, {passive:true});
  setVH();

  // ------- Inicialización -------

  (async ()=>{
    FULL_DATA = await loadDataOrCSV();
    const schedule = FULL_DATA.schedule || [];
    HOTELS = Array.from(new Set(schedule.map(s => s.hotel))).sort();

    // Rellenar selector de hoteles
    hotelSelect.innerHTML = [
      `<option value="__ALL__">Todos</option>`,
      ...HOTELS.map(h => `<option value="${h}">${h}</option>`)
    ].join("");

    hotelSelect.value = "__ALL__";

    const mondayToday = mondayOf(new Date());
    weekPicker.value  = toISODateUTC(mondayToday);

    refresh();
  })();

})();
