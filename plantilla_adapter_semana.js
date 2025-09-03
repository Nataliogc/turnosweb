/*  plantilla_adapter_semana.js
    Requiere: window.DATA = { rows: [...] } o bien un array directo.
*/
(() => {
  const RAW = Array.isArray(window.DATA) ? window.DATA : (window.DATA?.rows || []);
  if (!RAW || !RAW.length) {
    document.getElementById('app').innerHTML = '<div class="section"><div class="section-header">Sin datos</div></div>';
    return;
  }

  // --- Utils ---
  const norm = s => String(s ?? '').trim();
  const parseDate = v => {
    // Soporta Date serializado, ISO o "YYYY-MM-DD hh:mm:ss"
    const t = (typeof v === 'number') ? new Date(Math.round((v - 25569) * 86400 * 1000)) : new Date(v);
    return isNaN(t) ? null : t;
  };
  const fmtDM = d => d ? d.toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit' }) : '';
  const mondayOf = d => {
    const x = new Date(d); const day = (x.getDay()+6)%7; x.setDate(x.getDate()-day); x.setHours(0,0,0,0); return x;
  };
  const addDays = (d,n)=>{const x=new Date(d); x.setDate(x.getDate()+n); return x;};
  const key = o => JSON.stringify(o);

  // Normaliza filas
  const rows = RAW.map(r => {
    const Hotel = norm(r.Hotel ?? r.hotel);
    const Empleado = norm(r.Empleado ?? r.empleado ?? r.Trabajador);
    const Turno = norm(r.Turno ?? r.turno);
    const Fecha = parseDate(r.Fecha ?? r.fecha);
    const Semana = parseDate(r.Semana ?? r.semana) || (Fecha ? mondayOf(Fecha) : null);
    return { Hotel, Empleado, Turno, Fecha, Semana };
  }).filter(r => r.Hotel && r.Empleado && r.Fecha);

  // Hoteles para el selector
  const HOTELS = [...new Set(rows.map(r => r.Hotel))].sort();
  const selHotel = document.getElementById('selHotel');
  HOTELS.forEach(h => {
    const opt = document.createElement('option'); opt.value = h; opt.textContent = h; selHotel.appendChild(opt);
  });

  // Filtros
  const $q = document.getElementById('q');
  const $from = document.getElementById('from');
  const $to = document.getElementById('to');
  document.getElementById('btnClear').onclick = () => { $q.value=''; selHotel.value=''; $from.value=''; $to.value=''; render(); };

  // Última actualización
  const now = new Date();
  document.getElementById('updated').textContent = `Actualizado: ${now.toLocaleDateString('es-ES')} ${now.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`;

  // Clasifica un texto de turno a una "pastilla" visual
  const pillClass = (t) => {
    const s = t.toLowerCase();
    if (!s || s === '-' || s === '—') return ['p-descanso', ''];
    if (s.includes('vac')) return ['p-vacaciones', 'Vacaciones'];
    if (s.includes('desc')) return ['p-descanso', 'Descanso'];
    if (s.includes('mañ') || s.includes('man')) return ['p-maniana', 'Mañana'];
    if (s.includes('tar')) return ['p-tarde', 'Tarde'];
    if (s.includes('noc') || s.includes('noche')) return ['p-noche', 'Noches'];
    return ['p-descanso', t];
  };

  // Render principal
  const $app = document.getElementById('app');
  const weekdays = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

  $q.addEventListener('input', render);
  selHotel.addEventListener('change', render);
  $from.addEventListener('change', render);
  $to.addEventListener('change', render);

  function render(){
    const q = norm($q.value).toLowerCase();
    const hsel = norm(selHotel.value);
    const dFrom = $from.value ? new Date($from.value) : null;
    const dTo   = $to.value ? new Date($to.value)   : null;

    // Aplica filtros
    let fr = rows.filter(r => (!hsel || r.Hotel === hsel));
    if (q) fr = fr.filter(r => r.Empleado.toLowerCase().includes(q) || r.Hotel.toLowerCase().includes(q));
    if (dFrom) fr = fr.filter(r => r.Fecha >= dFrom);
    if (dTo)   fr = fr.filter(r => r.Fecha <= addDays(dTo, 1)); // inclusive

    // Agrupa: Hotel → Semana (lunes) → Empleado → Día
    const buckets = new Map(); // key({Hotel, Semana})
    for (const r of fr){
      const week = mondayOf(r.Semana || r.Fecha);
      const k = key({Hotel:r.Hotel, Semana:week.toISOString().slice(0,10)});
      if (!buckets.has(k)) buckets.set(k, { Hotel:r.Hotel, Semana:week, data:new Map() });
      const b = buckets.get(k);
      if (!b.data.has(r.Empleado)) b.data.set(r.Empleado, new Map());
      const emp = b.data.get(r.Empleado);
      const dayIdx = ((r.Fecha.getDay()+6)%7); // L=0..D=6
      emp.set(dayIdx, r.Turno);
    }

    // Construcción del DOM
    const frag = document.createDocumentFragment();

    [...buckets.values()]
      .sort((a,b)=> a.Hotel.localeCompare(b.Hotel) || a.Semana-b.Semana)
      .forEach(group => {
        const card = document.createElement('section'); card.className='section';

        const semanaTxt = `${group.Semana.toLocaleDateString('es-ES')} a ${addDays(group.Semana,6).toLocaleDateString('es-ES')}`;
        const header = document.createElement('div'); header.className='section-header';
        header.innerHTML = `<span class="meta">${group.Hotel}</span> — Semana ${semanaTxt} <span class="muted" style="float:right">${group.data.size} empleados / 7 días</span>`;
        card.appendChild(header);

        // cabecera de días
        const sticky = document.createElement('div'); sticky.className='sticky-head';
        const days = document.createElement('div'); days.className='days';
        days.appendChild(document.createElement('div')); // hueco empleado
        for (let i=0;i<7;i++){
          const d = addDays(group.Semana,i);
          const box = document.createElement('div');
          box.innerHTML = `<div class="daycap">${weekdays[i]}</div><div class="subcap">${fmtDM(d)}</div>`;
          days.appendChild(box);
        }
        sticky.appendChild(days);
        card.appendChild(sticky);

        // filas por empleado
        const table = document.createElement('div'); table.className='table';

        [...group.data.keys()].sort((a,b)=>a.localeCompare(b)).forEach(empName=>{
          const line = document.createElement('div'); line.className='row';
          const left = document.createElement('div'); left.className='employee';
          left.innerHTML = `<span class="dot"></span><span>${empName}</span>`;
          line.appendChild(left);

          const emp = group.data.get(empName);
          for (let i=0;i<7;i++){
            const cell = document.createElement('div'); cell.className='cell';
            const turno = emp.get(i) || '';
            const [klass, label] = pillClass(turno);
            const pill = document.createElement('div'); pill.className=`pill ${klass}`;
            pill.textContent = label || '—';
            cell.appendChild(pill);
            line.appendChild(cell);
          }
          table.appendChild(line);
        });

        card.appendChild(table);
        card.appendChild(Object.assign(document.createElement('div'), {className:'footer', textContent:'Generado automáticamente a partir de Excel'}));
        frag.appendChild(card);
      });

    $app.replaceChildren(frag);
  }

  render();
})();
