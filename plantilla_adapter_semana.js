/**
 * Adaptador de datos para la PLANTILLA OFICIAL (sin tocar estilos).
 * Requiere que los .py hayan inyectado `const DATA = { rows, sustituciones }` en el HTML.
 * Qué hace:
 *  - Lee DATA.rows (semanal) y DATA.sustituciones (CSV forzado).
 *  - Usa los selects existentes de la plantilla (Hotel y Semana, en ISO yyyy-mm-dd).
 *  - Renderiza la cuadrícula semanal (Empleado × L..D) respetando el orden del Excel.
 *  - Marca 🔄 cuando hay "Cambio de turno" en el CSV (Hotel+FechaNorm+Empleado/Sustituto).
 *  - (Opcional) imprime un pequeño resumen de noches debajo de la tabla si existe #resumen-noches.
 */
(function(){
  // --------- Helpers generales ---------
  const normalize = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const titleCase = s => String(s||'').replace(/\w\S*/g, t=>t.charAt(0).toUpperCase()+t.slice(1));
  const toISO = d => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '';
  const addDays = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };

  // Intenta detectar los elementos de tu plantilla sin cambiar el DOM ni estilos
  function pickHotelSelect(){
    return document.getElementById('selHotel')
        || document.querySelector('select#hotel')
        || document.querySelector('select[name*="hotel" i]')
        || document.querySelectorAll('select')[0];
  }
  function pickSemanaSelect(){
    return document.getElementById('selSemana')
        || document.querySelector('select#semana')
        || document.querySelector('select[name*="semana" i]')
        || document.querySelectorAll('select')[1];
  }
  function pickTableBody(){
    const byId = document.querySelector('#tabla tbody');
    if (byId) return byId;
    const t = document.querySelector('table'); // primera tabla (la plantilla suele tener una)
    return t ? (t.tBodies[0] || t.createTBody()) : null;
  }
  function pickMeta(){
    return document.getElementById('meta') || null;
  }

  // --------- Lectura de DATA con tolerancia a mayúsculas ---------
  const KEYMAP = {
    semana: ['semana','week'],
    hotel: ['hotel'],
    empleado: ['empleado','worker','employee','nombre'],
    lunes: ['lunes','monday'],
    martes: ['martes','tuesday'],
    miercoles: ['miercoles','miércoles','wednesday'],
    jueves: ['jueves','thursday'],
    viernes: ['viernes','friday'],
    sabado: ['sabado','sábado','saturday'],
    domingo: ['domingo','sunday'],
  };
  function pickKey(obj, logical){
    const lower = {}; for (const k in obj) lower[k.toLowerCase()] = k;
    for (const c of KEYMAP[logical]){ if (lower[c] != null) return obj[lower[c]]; }
    return undefined;
  }
  function parseWeekBase(s){
    if (s instanceof Date && !isNaN(s)) return s;
    s = String(s||'').trim();
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m){ let d=+m[1], M=(+m[2])-1, Y=+m[3]; if (Y<100) Y+=2000; return new Date(Y,M,d); }
    const d = new Date(s); return isNaN(d) ? null : d;
  }
  function clsPill(v){
    const t = normalize(v);
    if (t==='manana' || t==='mañana') return 'p-mañana';
    if (t==='tarde') return 'p-tarde';
    if (t==='noche') return 'p-noche';
    if (t==='descanso') return 'p-descanso';
    if (t.includes('vaca')) return 'p-vacaciones';
    return '';
  }

  // --------- Datos semanal + agrupación por empleado ---------
  function getWeeklyRows(){
    const rows = (window.DATA && (DATA.rows||DATA)) || [];
    return rows.map(r => ({
      semana: pickKey(r,'semana'),
      hotel: pickKey(r,'hotel'),
      empleado: pickKey(r,'empleado'),
      turnos: [
        pickKey(r,'lunes'), pickKey(r,'martes'), pickKey(r,'miercoles'),
        pickKey(r,'jueves'), pickKey(r,'viernes'), pickKey(r,'sabado'), pickKey(r,'domingo')
      ]
    }));
  }
  function groupByEmployee(rows, hotel, semanaISO){
    const seen = new Set(); const out = [];
    for (const r of rows){
      if (normalize(r.hotel) !== normalize(hotel)) continue;
      const base = parseWeekBase(r.semana); if (!base) continue;
      if (toISO(base) !== semanaISO) continue;
      const key = normalize(r.empleado);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
    return out;
  }

  // --------- Índice de sustituciones (CSV) ---------
  function buildSubsIndex(){
    const S = (window.DATA && DATA.sustituciones) || [];
    const map = new Map(); // key: hotel|fechaISO|personaLower -> boolCambio
    for (const row of S){
      const low = {}; for (const k in row) low[k.toLowerCase()] = k;
      const get = k => row[low[k]];
      const hotel = String(get('hotel') ?? '').trim();
      const fecha = String(get('fechanorm') ?? get('fechanormalizada') ?? get('fechanormal') ?? '').slice(0,10);
      const titular = String(get('empleado') ?? '').trim();
      const sub = String(get('sustituto') ?? '').trim();
      const cambio = String(get('cambiodeturno') ?? '').trim().toLowerCase() === 'true'
                  || normalize(get('tipointerpretado')).includes('cambio')
                  || normalize(get('motivo')).includes('cambio');
      if (!hotel || !fecha) continue;
      for (const persona of [titular, sub]){
        if (!persona) continue;
        const key = `${hotel.toLowerCase()}|${fecha}|${persona.toLowerCase()}`;
        map.set(key, (map.get(key) || false) || cambio);
      }
    }
    return map;
  }

  // --------- Render semanal ---------
  function render(){
    const selHotel  = pickHotelSelect();
    const selSemana = pickSemanaSelect();
    const tbody     = pickTableBody();
    const meta      = pickMeta();
    if (!selHotel || !selSemana || !tbody){ return; }

    const hotel     = selHotel.value || selHotel.options[0]?.value || '';
    const semanaISO = selSemana.value;

    const rows = getWeeklyRows();
    const vis  = groupByEmployee(rows, hotel, semanaISO);

    if (meta) meta.textContent = `${vis.length} empleados / 7 días`;

    const idx = buildSubsIndex();
    const [Y,M,D] = (semanaISO||'').split('-').map(n=>+n);
    const base = (Y && M && D) ? new Date(Y, M-1, D) : null;

    // Pintar cuerpo
    tbody.innerHTML = '';
    for (const r of vis){
      const tr = document.createElement('tr');
      const tdN = document.createElement('td');
      tdN.innerHTML = `<strong>${r.empleado||''}</strong>`;
      tr.appendChild(tdN);

      for (let i=0;i<7;i++){
        const v = r.turnos[i] ?? '';
        const td = document.createElement('td');
        const cls = 'pill ' + clsPill(v);
        let label = v ? titleCase(String(v)) : '';
        if (base){
          const iso = toISO(addDays(base, i));
          const k   = `${String(hotel).toLowerCase()}|${iso}|${String(r.empleado||'').toLowerCase()}`;
          if (idx.get(k)) label += ' <span title="Cambio de turno">🔄</span>';
        }
        td.innerHTML = `<span class="${cls}">${label}</span>`;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }

    // Resumen de noches (si existe contenedor)
    const cont = document.getElementById('resumen-noches');
    if (cont){
      let total=0; const by=new Map(), seen=new Set();
      for (const r of vis){
        const n = (r.turnos||[]).reduce((a,v)=>a + (normalize(v)==='noche'?1:0),0);
        by.set(r.empleado, (by.get(r.empleado)||0)+n);
      }
      const items=[];
      for (const r of vis){ if (seen.has(r.empleado)) continue; seen.add(r.empleado);
        const n = by.get(r.empleado)||0; total+=n;
        items.push(`<li><strong>${r.empleado}</strong>: ${n}</li>`);
      }
      cont.innerHTML = `<div><strong>Resumen de noches</strong> &nbsp; (Total: ${total})<ul>${items.map(x=>`<li>${x}</li>`).join('')}</ul></div>`;
    }
  }

  // Eventos (no tocamos estilos ni DOM)
  document.addEventListener('DOMContentLoaded', () => {
    const selHotel  = pickHotelSelect();
    const selSemana = pickSemanaSelect();
    if (selHotel)  selHotel.addEventListener('change', render);
    if (selSemana) selSemana.addEventListener('change', render);
    render();
  });
})();
