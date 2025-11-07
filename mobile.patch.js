/* mobile.patch.js — capa de compatibilidad para mobile, NO toca index/live */
(function () {
  // ---- Normalización de textos y emojis (arregla mojibake y restos) ----
  const MAP_FIX = [
    [/MaÃ±ana/g, 'Mañana'],
    [/Tarde/g, 'Tarde'],
    [/Noche\s*(?:ð[\u0000-\uFFFF]*|🌙)?/g, 'Noche 🌙'],
    [/Descanso(?:[^\w]|”|„)*/g, 'Descanso'],
    // Vacaciones y baja con restos “raros”
    [/Vacaciones(?:[^\w]|¤|–|ï¸|–)*/g, 'Vacaciones 🏖️'],
    [/Baja(?:[^\w]|¤|’|ï¸)*/g, 'Baja 🤒'],
    // Permiso / Formación / C/T
    [/Permiso(?:[^\w]|ðŸ—“ï¸)*/g, 'Permiso 🗓️'],
    [/Formaci[oó]n(?:[^\w]|ðŸ“)?/g, 'Formación 🎓'],
    // Cambio de turno (C/T, Cambio, ↔ -> 🔄)
    [/\bC\/T\b|Cambio(?:\s+de)?\s+turno|\u2194/g, 'C/T 🔄'],
    // Ruidos habituales
    [/[\uFFFD\u0092\u00AD]/g, ''] //   , controles, soft hyphen
  ];

  function normalizeCell(txt) {
    if (!txt) return '';
    let out = String(txt);
    MAP_FIX.forEach(([re, rep]) => (out = out.replace(re, rep)));
    // Si quedó “Noche” sin emoji, se lo añadimos
    if (/^Noche\s*$/.test(out)) out = 'Noche 🌙';
    return out.trim();
  }

  // ---- Utilidad: comprueba si una fila está vacía (todo “—” o vacío) ----
  function rowIsEmpty(tr) {
    const tds = [...tr.querySelectorAll('td.turno-cell, td')].slice(1); // ignora primera (nombre)
    if (!tds.length) return false;
    return tds.every(td => {
      const v = normalizeCell(td.textContent || '').replace(/—/g, '').trim();
      return v === '';
    });
  }

  // ---- Fuente de datos flexible ----
  function getRows(){
    const S = window.SCHEDULE || window.FULL_DATA || window.DATA || {};
    if (Array.isArray(S)) return S;
    if (Array.isArray(S.schedule)) return S.schedule;
    if (Array.isArray(S.data))     return S.data;
    if (Array.isArray(S.rows))     return S.rows;
    return [];
  }

  // ---- Pick helpers ----
  const pick = (o, keys) => {
    for (const k of keys) if (o && (k in o) && o[k]!=null && String(o[k]).trim()!=='') return String(o[k]).trim();
    return '';
  };
  const COL = {
    hotel: ['hotel','Hotel','establecimiento','Establecimiento'],
    emp:   ['empleado','Empleado','employee','nombre','name','persona'],
    fecha: ['fecha','Fecha','date','dia','day'],
    turno: ['turno','Turno','shift','tramo','TipoAusencia','ausencia','motivo']
  };

  // ---- Fechas ----
  const DAY = 86400000;
  const toISO   = d => (typeof d === 'string') ? d.slice(0,10) : new Date(d).toISOString().slice(0,10);
  const fromISO = s => new Date(s);
  const addDays = (iso, n) => toISO(new Date(fromISO(iso).getTime()+n*DAY));
  const mondayOf = any => {
    const d = new Date(any); const wd = (d.getDay()+6)%7;
    return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate()-wd));
  };

  // ---- Agrupa por hotel + semana (lunes) ----
  function buildMap(){
    const rows = getRows();
    const map = new Map();
    for (const r of rows){
      const h = pick(r, COL.hotel);
      const e = pick(r, COL.emp);
      const f = toISO(pick(r, COL.fecha));
      const t = pick(r, COL.turno);
      if (!h || !e || !f) continue;
      const mon = mondayOf(f);
      const key = `${h}|${mon}`;
      if (!map.has(key)) map.set(key, {hotel:h, week:mon, byEmp:new Map()});
      const wk = map.get(key);
      if (!wk.byEmp.has(e)) wk.byEmp.set(e, {});
      wk.byEmp.get(e)[f] = t ? normalizeCell(t) : '';
    }
    return map;
  }

  // ---- Píldoras ----
  function pill(label){
    const txt = label || '';
    const l = txt.toLowerCase();
    let cls = 'pill';
    if (l.startsWith('mañana'))   cls += ' pill-am';
    else if (l.startsWith('tarde'))   cls += ' pill-pm';
    else if (l.startsWith('noche'))   cls += ' pill-night';
    else if (l.startsWith('descanso'))cls += ' pill-off';
    else if (l.startsWith('vacaciones')) cls += ' pill-vac';
    else if (l.startsWith('baja'))     cls += ' pill-low';
    else if (l.startsWith('permiso'))  cls += ' pill-perm';
    else if (l.startsWith('formación'))cls += ' pill-form';
    else if (l.startsWith('c/t'))      cls += ' pill-ct';
    return `<span class="${cls}">${txt}</span>`;
  }

  // ---- CSS mínimo ----
  const STYLE = `
  .weekCard{background:#fff;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.08);padding:12px;margin:10px 0}
  .weekHead{display:flex;align-items:center;gap:12px;margin-bottom:8px}
  .weekLogo{width:36px;height:36px;object-fit:contain;border-radius:8px}
  .weekTitle{font:700 1rem system-ui;color:#122}
  .weekRange{font:600 .85rem system-ui;color:#456}
  .grid{width:100%;border-collapse:collapse}
  .grid th,.grid td{border-bottom:1px solid #eef3f7;padding:10px 8px;vertical-align:middle}
  .grid th{font:700 .85rem system-ui;color:#2a3a46;background:#f8fafc}
  .emp{white-space:nowrap;font:600 .95rem system-ui;color:#112}
  .muted{color:#9fb0c0}
  .pill{display:inline-block;padding:.25rem .6rem;border-radius:999px;font:700 .8rem system-ui}
  .pill-am{background:#e7f7ea;color:#136b2c}
  .pill-pm{background:#fff3d6;color:#7e5b00}
  .pill-night{background:#eae6ff;color:#3e2b84}
  .pill-off{background:#ffe0e0;color:#8b1b1b}
  .pill-vac{background:#dff5ff;color:#035f88}
  .pill-low{background:#fde4ff;color:#7b2d86}
  .pill-perm{background:#e9f0ff;color:#274d9c}
  .pill-form{background:#efe7ff;color:#5b2d91}
  .pill-ct{background:#e6fff2;color:#0f6a45}
  `;
  function ensureStyle(){
    if (document.getElementById('mobile-inline-style')) return;
    const s=document.createElement('style'); s.id='mobile-inline-style'; s.textContent=STYLE; document.head.appendChild(s);
  }

  // ---- Render público para móvil ----
  window.MobileRenderer = {
    renderWeek(target, opts){
      ensureStyle();

      const normalize = typeof opts.normalize==='function' ? opts.normalize : (x=>x);
      const hideEmpty = !!opts.hideEmptyEmployees;
      const weekStartISO = opts.weekStartISO || mondayOf(new Date());
      const map = buildMap();

      // Filtrado por hotel
      const cards = [];
      const days = Array.from({length:7}, (_,i)=> addDays(weekStartISO,i));
      for (const [, wk] of map){
        if (opts.hotel && wk.hotel !== opts.hotel) continue;
        if (wk.week !== weekStartISO) continue; // solo esa semana

        const logo = wk.hotel.toLowerCase().includes('cumbria') ? 'img/logo_cumbria.png' : 'img/logo_guadiana.png';
        const range = `${weekStartISO} → ${addDays(weekStartISO,6)}`;

        const rowsHtml = [];
        for (const [emp, byDate] of wk.byEmp){
          if (opts.empleado && emp!==opts.empleado) continue;

          let has = false;
          const tds = days.map(d=>{
            let raw = byDate[d] || ''; raw = normalize(normalizeCell(raw));
            if (raw && raw!=='—') has = true;
            return `<td>${raw ? pill(raw) : '<span class="muted">—</span>'}</td>`;
          }).join('');

          if (hideEmpty && !has) continue;
          rowsHtml.push(`<tr><td class="emp">${emp}</td>${tds}</tr>`);
        }

        const tableHtml = `
          <div class="weekCard">
            <div class="weekHead">
              <img class="weekLogo" src="${logo}" alt="">
              <div>
                <div class="weekTitle">${wk.hotel}</div>
                <div class="weekRange">${range}</div>
              </div>
            </div>
            <table class="grid">
              <thead>
                <tr>
                  <th>Empleado</th>
                  ${days.map((d,i)=>`<th>${['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'][i]}<br>${d.split('-').reverse().join('/')}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${rowsHtml.join('') || '<tr><td colspan="8" class="muted">No hay datos para los filtros seleccionados.</td></tr>'}
              </tbody>
            </table>
          </div>
        `;
        cards.push(tableHtml);
      }
      target.innerHTML = cards.join('') || `<p class="hint">Selecciona un hotel y fechas en <strong>Filtros</strong>.</p>`;
    }
  };

  // ---- Hook tras render: normaliza celdas y oculta filas vacías ----
  function patchAfterRender() {
    const root = document.getElementById('app') || document.body;
    const allCells = root.querySelectorAll('td, .pill, .turno, .chip');
    allCells.forEach(el => {
      if (el.firstElementChild) return;        // no romper HTML interno
      el.textContent = normalizeCell(el.textContent);
    });
    const rows = root.querySelectorAll('table tbody tr');
    rows.forEach(tr => { if (rowIsEmpty(tr)) tr.style.display = 'none'; });
  }

  document.addEventListener('mobile:rendered', patchAfterRender);
  ['click', 'change'].forEach(ev => document.addEventListener(ev, () => {
    clearTimeout(window.__mobPatchTimer);
    window.__mobPatchTimer = setTimeout(patchAfterRender, 30);
  }));
  document.addEventListener('DOMContentLoaded', () => setTimeout(patchAfterRender, 30));
})();
