(() => {
  // Utilidades
  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const fmt = (d) => new Date(d).toLocaleDateString('es-ES',{weekday:'short', day:'2-digit', month:'short', year:'2-digit'});

  // Estado
  let DATA = null; // { schedule:[{hotel, semana_lunes, orden_empleados, turnos:[{empleado,fecha,turno, ...}]}] }

  // ==== Entrada de datos =====================================================
  async function initData(){
    // 1) Si existe window.FULL_DATA (data.js), úsalo.
    if (window.FULL_DATA?.schedule?.length) {
      DATA = window.FULL_DATA;
      return;
    }
    // 2) Intentar CSV (turnos.csv y ausencias.csv)
    try {
      const [turnosCsv, ausCsv] = await Promise.all([
        fetch('turnos.csv').then(r => r.ok ? r.text() : ''),
        fetch('ausencias.csv').then(r => r.ok ? r.text() : '')
      ]);
      if (turnosCsv.trim().length) {
        DATA = csvToFullData(turnosCsv, ausCsv);
        return;
      }
    } catch(_) { /* sin datos */ }

    // 3) Si todo falla, dejar un dataset vacío para que no rompa.
    DATA = { schedule: [] };
  }

  // Parseador CSV simple (sin librerías)
  function csvToRows(txt){
    // Soporta comillas y separadores ; o ,
    const sep = txt.includes(';') ? ';' : ',';
    const lines = txt.replace(/\r/g,'').split('\n').filter(l=>l.trim().length);
    const out = [];
    for (const line of lines){
      const row = [];
      let cur='', inQ=false;
      for (let i=0;i<line.length;i++){
        const c = line[i];
        if (c === '"'){ inQ = !inQ; continue; }
        if (c === sep && !inQ){ row.push(cur.trim()); cur=''; continue; }
        cur += c;
      }
      row.push(cur.trim());
      out.push(row);
    }
    return out;
  }

  // Convierte CSV a estructura FULL_DATA mínima
  function csvToFullData(turnosCsv, ausCsv){
    const rows = csvToRows(turnosCsv);
    const hdr = rows.shift().map(h => h.toLowerCase());
    // Campos esperados (flexible a acentos/variantes)
    const ci = {
      hotel: hdr.findIndex(h=>/hotel/.test(h)),
      empleado: hdr.findIndex(h=>/emplead/.test(h)),
      fecha: hdr.findIndex(h=>/fecha/.test(h)),
      turno: hdr.findIndex(h=>/turno/.test(h))
    };
    const map = new Map(); // key: hotel|lunesISO -> {hotel, semana_lunes, orden_empleados:Set, turnos:[]}

    for (const r of rows){
      const hotel = r[ci.hotel] || 'Hotel';
      const f = new Date(r[ci.fecha]);
      if (isNaN(f)) continue;
      // lunes de esa semana
      const lunes = new Date(f);
      const wd = (lunes.getDay()+6)%7; // 0 = lunes
      lunes.setDate(lunes.getDate()-wd);
      const lunesISO = lunes.toISOString().slice(0,10);

      const k = hotel+'|'+lunesISO;
      if (!map.has(k)) map.set(k, {hotel, semana_lunes: lunesISO, orden_empleados: new Set(), turnos: []});
      const pack = map.get(k);
      const empleado = r[ci.empleado] || '';
      const turno = r[ci.turno] || '';
      pack.orden_empleados.add(empleado);
      pack.turnos.push({empleado, fecha: f.toISOString().slice(0,10), turno});
    }

    const schedule = Array.from(map.values()).map(p=>({
      hotel: p.hotel,
      semana_lunes: p.semana_lunes,
      orden_empleados: Array.from(p.orden_empleados),
      turnos: p.turnos
    }));
    return { schedule };
  }

  // ==== Render ===============================================================
  function render(){
    const tabla = $('#tablaTurnos');
    const semana = $('#semanaInput').value || defaultMonday();
    const hotel = $('#hotelSelect').value || (DATA.schedule[0]?.hotel || 'Hotel');

    const pack = DATA.schedule.find(s => s.hotel===hotel && s.semana_lunes===semana);
    $('#hotelNombre').textContent = hotel;
    $('#rangoFechas').textContent = rangoSemana(semana);

    if (!pack){
      tabla.innerHTML = `<div class="t-empty" style="padding:16px;color:#6b7280;">Sin datos para ${hotel} — ${fmt(semana)}</div>`;
      return;
    }

    // Preparar días L→D
    const dias = new Array(7).fill(0).map((_,i)=>{
      const d = new Date(semana); d.setDate(d.getDate()+i);
      return { iso: d.toISOString().slice(0,10), label: d.toLocaleDateString('es-ES',{weekday:'short'}), fecha: d.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'2-digit'}) };
    });

    // Indexar turnos por empleado+fecha
    const byEmpDate = new Map(); // "empleado|fecha" -> [turno, ...]
    for (const t of pack.turnos){
      const k = t.empleado+'|'+t.fecha;
      if (!byEmpDate.has(k)) byEmpDate.set(k, []);
      byEmpDate.get(k).push(t.turno);
    }

    // Filtrar empleados sin turnos esa semana
    const visibles = pack.orden_empleados.filter(emp => dias.some(d => byEmpDate.has(emp+'|'+d.iso)));

    // Cabecera
    let html = `<div class="t-head">`
              + `<div class="cell"></div>`
              + dias.map(d=>`<div class="cell"><div>${capitalize(d.label)}</div><div>${d.fecha}</div></div>`).join('')
              + `</div>`;

    // Filas
    for (const emp of visibles){
      html += `<div class="t-row">
        <div class="cell name"><div class="emp">${emp}</div></div>
        ${dias.map(d=>{
          const turns = byEmpDate.get(emp+'|'+d.iso) || [];
          return `<div class="cell"><div class="shifts">${turns.map(pillHTML).join('')}</div></div>`;
        }).join('')}
      </div>`;
    }

    tabla.innerHTML = html;
  }

  function pillHTML(t){
    const val = normalizaTurno(t);
    const map = {
      'mañana':  { cls:'pill--manana', txt:'Mañana', icon:'' },
      'tarde':   { cls:'pill--tarde',  txt:'Tarde',  icon:'🛈' },
      'noche':   { cls:'pill--noche',  txt:'Noche',  icon:'🌙' },
      'descanso':{ cls:'pill--descanso', txt:'Descanso', icon:'' },
      'vacaciones':{ cls:'pill--vacaciones', txt:'Vacaciones', icon:'🏖️' }
    };
    const m = map[val] || {cls:'', txt:t, icon:''};
    return `<span class="pill ${m.cls}">${m.icon?`<span class="i">${m.icon}</span>`:''}<span>${m.txt}</span></span>`;
  }

  function normalizaTurno(s=''){
    s = s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim();
    // admite variantes y emojis que estaban saliendo mal en CSV
    if (/manana|m/i.test(s) && !/tarde|noche/.test(s)) return 'mañana';
    if (/tarde|t/i.test(s) && !/manana|noche/.test(s)) return 'tarde';
    if (/noche|n/i.test(s) && !/manana|tarde/.test(s)) return 'noche';
    if (/descanso|libre|d/i.test(s)) return 'descanso';
    if (/vacacion|vac/i.test(s)) return 'vacaciones';
    return s;
  }

  function defaultMonday(){
    // lunes de la semana actual
    const d = new Date();
    const wd = (d.getDay()+6)%7;
    d.setDate(d.getDate()-wd);
    return d.toISOString().slice(0,10);
  }

  function rangoSemana(lunesISO){
    const d0 = new Date(lunesISO);
    const d6 = new Date(lunesISO); d6.setDate(d6.getDate()+6);
    const f0 = d0.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'2-digit'});
    const f6 = d6.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'2-digit'});
    return `${f0} → ${f6}`;
  }

  function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

  // ==== UI ===================================================================
  function populateHotelSelect(){
    const sel = $('#hotelSelect');
    const names = Array.from(new Set(DATA.schedule.map(s=>s.hotel)));
    sel.innerHTML = names.map(n=>`<option value="${n}">${n}</option>`).join('');
  }

  function syncSemana(){
    const inp = $('#semanaInput');
    if (!inp.value) inp.value = defaultMonday();
  }

  // ==== Start ================================================================
  document.addEventListener('DOMContentLoaded', async ()=>{
    await initData();
    populateHotelSelect();
    syncSemana();
    render();

    $('#refrescarBtn').addEventListener('click', render);
    $('#hotelSelect').addEventListener('change', render);
    $('#semanaInput').addEventListener('change', render);
  });
})();
