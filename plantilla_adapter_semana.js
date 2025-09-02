/** 
 * Adaptador de datos para la PLANTILLA OFICIAL (sin tocar estilos).
 * - Autorrellena los <select> de Hotel y Semana desde DATA.rows si vienen vacíos.
 * - Pinta cuadrícula semanal (Empleado × L..D) respetando orden Excel.
 * - Marca 🔄 usando DATA.sustituciones (CSV) por Hotel+FechaISO+Empleado/Sustituto.
 */
(function(){
  // ---------- helpers ----------
  const $ = s => document.querySelector(s);
  const normalize = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const titleCase = s => String(s||'').replace(/\w\S*/g, t=>t.charAt(0).toUpperCase()+t.slice(1));
  const addDays = (d,n)=>{ const x=new Date(d); x.setDate(x.getDate()+n); return x; };
  const toISO = d => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '';

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
    const t = document.querySelector('table');
    return t ? (t.tBodies[0] || t.createTBody()) : null;
  }
  function pickMeta(){ return document.getElementById('meta') || null; }

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
  const clsPill = v => {
    const t = normalize(v);
    if (t==='manana' || t==='mañana') return 'p-mañana';
    if (t==='tarde') return 'p-tarde';
    if (t==='noche') return 'p-noche';
    if (t==='descanso') return 'p-descanso';
    if (t.includes('vaca')) return 'p-vacaciones';
    return '';
  };

  function weeklyRows(){
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

  function uniqInOrder(arr){
    const out=[], seen=new Set();
    for (const v of arr){ const k=JSON.stringify(v); if(!seen.has(k)){ seen.add(k); out.push(v);} }
    return out;
  }

  function hotelsFromRows(rows){ return uniqInOrder(rows.map(r=>r.hotel).filter(Boolean)); }
  function semanasISOFromRows(rows, hotel){
    const list=[];
    for (const r of rows){
      if (normalize(r.hotel)!==normalize(hotel)) continue;
      const base=parseWeekBase(r.semana); if (!base) continue;
      list.push(toISO(base));
    }
    return uniqInOrder(list);
  }

  // Sustituciones
  function subsIndex(){
    const S = (window.DATA && DATA.sustituciones) || [];
    const map = new Map();
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

  function groupByEmployee(rows, hotel, semanaISO){
    const seen=new Set(), out=[];
    for (const r of rows){
      if (normalize(r.hotel)!==normalize(hotel)) continue;
      const base=parseWeekBase(r.semana); if (!base) continue;
      if (toISO(base)!==semanaISO) continue;
      const k=normalize(r.empleado);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
    return out;
  }

  function render(){
    const selH = pickHotelSelect();
    const selS = pickSemanaSelect();
    const tb   = pickTableBody();
    const meta = pickMeta();
    if (!selH || !selS || !tb) return;

    const rows = weeklyRows();

    // Autorellenar selects si están vacíos
    if (!selH.options.length){
      const hs = hotelsFromRows(rows);
      for (const h of hs){ const o=document.createElement('option'); o.value=h; o.textContent=h; selH.appendChild(o); }
    }
    if (!selS.options.length){
      const h = selH.value || selH.options[0]?.value || '';
      const ss = semanasISOFromRows(rows, h);
      for (const s of ss){ const o=document.createElement('option'); o.value=s; o.textContent=s; selS.appendChild(o); }
    }
    // Asegurar semanas del hotel seleccionado
    const wantH = selH.value || selH.options[0]?.value || '';
    const haveForH = Array.from(selS.options).some(o=>semanasISOFromRows(rows, wantH).includes(o.value));
    if (!haveForH){
      selS.innerHTML='';
      for (const s of semanasISOFromRows(rows, wantH)){ const o=document.createElement('option'); o.value=s; o.textContent=s; selS.appendChild(o); }
    }

    const hotel = selH.value || selH.options[0]?.value || '';
    const semanaISO = selS.value || selS.options[0]?.value || '';

    const vis = groupByEmployee(rows, hotel, semanaISO);
    if (meta) meta.textContent = `${vis.length} empleados / 7 días`;

    const idx = subsIndex();
    const [Y,M,D] = (semanaISO||'').split('-').map(n=>+n);
    const base = (Y&&M&&D) ? new Date(Y, M-1, D) : null;

    tb.innerHTML='';
    for (const r of vis){
      const tr=document.createElement('tr');
      const tdN=document.createElement('td'); tdN.innerHTML = `<strong>${r.empleado||''}</strong>`; tr.appendChild(tdN);
      for (let i=0;i<7;i++){
        const v=r.turnos[i]??'';
        const td=document.createElement('td');
        const cls='pill '+clsPill(v);
        let label = v ? titleCase(String(v)) : '';
        if (base){
          const iso = toISO(addDays(base,i));
          const k = `${String(hotel).toLowerCase()}|${iso}|${String(r.empleado||'').toLowerCase()}`;
          if (idx.get(k)) label += ' <span title="Cambio de turno">🔄</span>';
        }
        td.innerHTML = `<span class="${cls}">${label}</span>`;
        tr.appendChild(td);
      }
      tb.appendChild(tr);
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    const selH = pickHotelSelect();
    const selS = pickSemanaSelect();
    if (selH) selH.addEventListener('change', ()=>{ 
      // cuando cambia hotel, repoblar semanas para ese hotel
      const rows = weeklyRows();
      const ss = semanasISOFromRows(rows, selH.value || selH.options[0]?.value || '');
      selS.innerHTML=''; for (const s of ss){ const o=document.createElement('option'); o.value=s; o.textContent=s; selS.appendChild(o); }
      render();
    });
    if (selS) selS.addEventListener('change', render);
    render();
  });
})();
