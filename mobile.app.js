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

  // DOM
  const weekPicker = $("#weekPicker");
  const hotelSelect = $("#hotelSelect");
  const refreshBtn = $("#refreshBtn");
  const prevWeekBtn = $("#prevWeekBtn");
  const todayBtn = $("#todayBtn");
  const nextWeekBtn = $("#nextWeekBtn");
  const thead = $("#thead");
  const tbody = $("#tbody");
  const hotelTitle = $("#hotelTitle");
  const hotelLogo = $("#hotelLogo");

  // Cargar lista de hoteles del FULL_DATA
  const DATA = (window.FULL_DATA && window.FULL_DATA.schedule) ? window.FULL_DATA.schedule : [];
  const HOTELS = [...new Set(DATA.map(s => s.hotel))];
  hotelSelect.innerHTML = HOTELS.map(h => `<option value="${h}">${h}</option>`).join("");

  // Semana por defecto: si existe en el dataset, usa la primera; si no, el lunes de hoy.
  let defaultWeek = mondayOf(new Date());
  const monday = mondayOf(new Date(defaultWeek));
  weekPicker.value = toISODateUTC(monday);

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
          let label = (window.MobilePatch? window.MobilePatch.normalize(item.turno||"") : (item.turno||""));
          // Normalizaciones visuales
          if(/descanso/i.test(label)){ pill.classList.add("rest"); label = "Descanso"; }
          else if(/noche/i.test(label)){ pill.classList.add("night"); label = "🌙 Noche"; }
          else { pill.style.background="#fff7db"; pill.style.color="#5b4300"; } // Mañana/Tarde/otros
          pill.textContent = label;
          cell.appendChild(pill);
        }
        row.appendChild(cell);
      }
      tbody.appendChild(row);
    });
  }

  function refresh(){
    const hotel = hotelSelect.value;
    const monday = new Date(weekPicker.value);
    hotelTitle.textContent = (window.MobilePatch? window.MobilePatch.normalize(hotel):hotel);
    hotelLogo.src = logoFor(hotel);
    hotelLogo.onerror = ()=>{ hotelLogo.src = 'img/logo.png'; };
    renderHeader(monday);
    const weekData = window.MobileAdapter.buildWeekData(window.FULL_DATA, hotel, monday);
    renderBody(weekData);
  }

  refreshBtn.addEventListener("click", refresh);
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
