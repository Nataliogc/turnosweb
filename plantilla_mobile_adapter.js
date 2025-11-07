/* plantilla_mobile_adapter.js — Adaptador SOLO móvil, por hotel */
(function () {
  'use strict';

  // ===== utilidades robustas de fecha =====
  const DAY = 86400000;
  function toISO(d){
    if(!d) return '';
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt)) return '';
    const z = new Date(dt.getTime() - dt.getTimezoneOffset()*60000);
    return z.toISOString().slice(0,10);
  }
  const fromISO = s => new Date(s);
  const addDays = (iso, n) => iso ? toISO(new Date(fromISO(iso).getTime()+n*DAY)) : '';
  const mondayOf = any => {
    const base = any instanceof Date ? any : new Date(any||Date.now());
    if (isNaN(base)) return toISO(new Date());
    const wd = (base.getDay()+6)%7;
    const m = new Date(base); m.setDate(base.getDate()-wd);
    return toISO(m);
  };
  const spanISO = mon => ({mon, sun: addDays(mon,6)});

  // ===== lectura flexible de filas =====
  function getRows(D){
    if (!D) return [];
    if (Array.isArray(D.rows))     return D.rows;
    if (Array.isArray(D.data))     return D.data;
    if (Array.isArray(D.schedule)) return D.schedule;
    if (Array.isArray(D))          return D;

    // fallback FULL_DATA.hoteles/personas/turnos
    const out = [];
    const H = Array.isArray(D.hoteles)? D.hoteles : [];
    for (const h of H){
      const personas = Array.isArray(h.personas||h.empleados) ? (h.personas||h.empleados) : [];
      for (const p of personas){
        const map = p.turnos || p.shifts || {};
        for (const [fecha, turno] of Object.entries(map)){
          out.push({
            hotel: h.nombre||h.codigo||h.id||'',
            empleado: p.nombre||p.name||'',
            fecha, turno
          });
        }
      }
    }
    return out;
  }

  // ===== UI: píldoras =====
  function pill(txt){
    const t = String(txt||'').trim(), l = t.toLowerCase();
    let cls = 'pill';
    if (l.startsWith('mañana')) cls+=' pill-am';
    else if (l.startsWith('tarde')) cls+=' pill-pm';
    else if (l.startsWith('noche')) cls+=' pill-night';
    else if (l.startsWith('descanso')) cls+=' pill-off';
    else if (l.startsWith('vacaciones')) cls+=' pill-vac';
    else if (l.startsWith('baja')) cls+=' pill-low';
    else if (l.startsWith('permiso')) cls+=' pill-perm';
    else if (l.startsWith('formación')) cls+=' pill-form';
    else if (l.startsWith('c/t')) cls+=' pill-ct';
    return t ? `<span class="${cls}">${t}</span>` : '<span class="muted">—</span>';
  }

  // ===== estilos mínimos =====
  function ensureStyle(){
    if (document.getElementById('mobile-inline-style')) return;
    const s = document.createElement('style'); s.id='mobile-inline-style';
    s.textContent = `
      .weekGroup{margin:12px 0}
      .weekCard{background:#fff;border-radius:14px;box-shadow:0 6px 18px rgba(10,30,60,.08);padding:14px}
      .weekHead{display:flex;align-items:center;gap:12px;margin-bottom:10px}
      .weekLogo{width:42px;height:42px;border-radius:10px;object-fit:contain}
      .weekTitle{font:700 16px system-ui;color:#10212c}
      .weekRange{font:600 13px system-ui;color:#4e6b82}
      .grid{width:100%;border-collapse:collapse}
      .grid th,.grid td{border-bottom:1px solid #eef2f7;padding:10px 8px;vertical-align:middle}
      .grid th{font:700 13px system-ui;color:#243748;background:#f8fafc}
      .emp{white-space:nowrap;font:600 14px system-ui;color:#112}
      .muted{color:#9fb0c0}
      .pill{display:inline-block;padding:.28rem .62rem;border-radius:999px;font:700 .82rem system-ui}
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
    document.head.appendChild(s);
  }

  // ===== render principal: por hotel =====
  window.renderContent = function renderContent(DATA, opts = {}){
    ensureStyle();

    const rows = getRows(DATA);
    const weekStart = mondayOf(opts.dateFrom || new Date());
    const days = Array.from({length:7}, (_,i)=> addDays(weekStart, i));

    // Hoteles presentes (en orden alfabético)
    const allHotels = [...new Set(rows.map(r => String(r.hotel||r.Hotel||r.establecimiento||'').trim()).filter(Boolean))].sort();
    const hotels = (opts.hotel && opts.hotel.trim())
      ? [opts.hotel.trim()]
      : allHotels;

    const target = document.getElementById('monthly-summary-container')
               || document.querySelector('#app')
               || document.querySelector('main')
               || document.body;
    target.innerHTML = '';

    // helper cabecera de días
    const headers = ['Empleado','Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((x,i)=>
      i===0 ? `<th>${x}</th>` : `<th>${x}<br>${days[i-1].split('-').reverse().join('/')}</th>`
    ).join('');

    // pintar por hotel
    for (const hName of hotels){
      // filtrar filas de la semana y del hotel hName
      const filt = rows.filter(r=>{
        const hotel = String(r.hotel||r.Hotel||r.establecimiento||'').trim();
        const dt = toISO(r.fecha||r.Fecha||r.day||r.date);
        if (!dt) return false;
        const okHotel = !hName ? true : (hotel === hName);
        return okHotel && days.includes(dt);
      });

      // agrupar por empleado
      const byEmp = new Map();
      for (const r of filt){
        const emp = String(r.empleado||r.Empleado||r.nombre||r.name||r.persona||'').trim();
        const dt  = toISO(r.fecha||r.Fecha||r.day||r.date);
        const t   = String(r.turno||r.Turno||r.TipoAusencia||r.ausencia||'').trim();
        if (!emp || !dt) continue;
        if (!byEmp.has(emp)) byEmp.set(emp, {});
        byEmp.get(emp)[dt] = t;
      }

      // logo por hotel
      const logo = /cumbria/i.test(hName) ? 'img/cumbria.jpg' : /guadiana/i.test(hName) ? 'img/guadiana.jpg' : 'img/turnos_icon.png';
      const rng = `${weekStart.split('-').reverse().join('/')} → ${addDays(weekStart,6).split('-').reverse().join('/')}`;

      const rowsHtml = [];
      for (const [emp, map] of byEmp){
        const tds = days.map(d => `<td>${pill(map[d]||'')}</td>`).join('');
        rowsHtml.push(`<tr><td class="emp">${emp}</td>${tds}</tr>`);
      }

      const tableBody = rowsHtml.join('') || `<tr><td colspan="8" class="muted">No hay datos para esta semana.</td></tr>`;

      const card = `
        <section class="weekGroup">
          <div class="weekCard">
            <div class="weekHead">
              <img class="weekLogo" src="${logo}" alt="${hName}">
              <div>
                <div class="weekTitle">${hName || 'Sin hotel'}</div>
                <div class="weekRange">${rng}</div>
              </div>
            </div>
            <table class="grid">
              <thead><tr>${headers}</tr></thead>
              <tbody>${tableBody}</tbody>
            </table>
          </div>
        </section>
      `;
      target.insertAdjacentHTML('beforeend', card);
    }

    if (!hotels.length){
      target.innerHTML = `
        <section class="weekGroup">
          <div class="weekCard">
            <table class="grid">
              <thead><tr>${headers}</tr></thead>
              <tbody><tr><td colspan="8" class="muted">No se han detectado hoteles en los datos.</td></tr></tbody>
            </table>
          </div>
        </section>`;
    }
  };
})();
