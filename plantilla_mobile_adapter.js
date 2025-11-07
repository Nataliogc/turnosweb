/* plantilla_mobile_adapter.js — SOLO móvil (safe) */
(function () {
  'use strict';

  // === utilidades robustas de fecha ===
  const DAY = 86400000;

  function toISO(d) {
    if (!d) return '';                          // <- evita undefined/null
    let dt = d;
    if (!(d instanceof Date)) dt = new Date(d); // acepta string o timestamp
    if (!(dt instanceof Date) || isNaN(dt)) return '';
    const z = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  }
  const fromISO = s => new Date(s);
  const addDays = (iso, n) => {
    if (!iso) return '';
    const t = fromISO(iso).getTime();
    if (isNaN(t)) return '';
    return toISO(new Date(t + n * DAY));
  };
  const mondayOf = any => {
    const base = (any instanceof Date) ? any : new Date(any || Date.now());
    if (isNaN(base)) return toISO(new Date());
    const wd = (base.getDay() + 6) % 7; // lunes=0
    const m = new Date(base); m.setDate(base.getDate() - wd);
    return toISO(m);
  };

  // === lectura flexible de filas ===
  function getRows(D) {
    if (!D) return [];
    if (Array.isArray(D.rows))      return D.rows;
    if (Array.isArray(D.data))      return D.data;
    if (Array.isArray(D.schedule))  return D.schedule;
    if (Array.isArray(D))           return D;

    // fallback FULL_DATA.hoteles/personas/turnos
    const out = [];
    const H = Array.isArray(D.hoteles) ? D.hoteles : [];
    for (const h of H) {
      const personas = Array.isArray(h.personas||h.empleados) ? (h.personas||h.empleados) : [];
      for (const p of personas) {
        const map = p.turnos || p.shifts || {};
        for (const [fecha, turno] of Object.entries(map)) {
          out.push({ hotel: h.nombre||h.codigo||h.id||'', empleado: p.nombre||p.name||'', fecha, turno });
        }
      }
    }
    return out;
  }

  // === UI mínima ===
  function pill(txt) {
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

  function ensureStyle() {
    if (document.getElementById('mobile-inline-style')) return;
    const s = document.createElement('style'); s.id='mobile-inline-style';
    s.textContent = `
      .weekCard{background:#fff;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.08);padding:12px;margin:10px 0}
      .grid{width:100%;border-collapse:collapse}
      .grid th,.grid td{border-bottom:1px solid #eef3f7;padding:10px 8px;vertical-align:middle}
      .grid th{font:700 .85rem system-ui;color:#2a3a46;background:#f8fafc}
      .emp{white-space:nowrap;font:600 .95rem system-ui;color:#112}
      .muted{color:#9fb0c0}
      .pill{display:inline-block;padding:.25rem .6rem;border-radius:999px;font:700 .8rem system-ui}
      .pill-am{background:#e7f7ea;color:#136b2c}.pill-pm{background:#fff3d6;color:#7e5b00}
      .pill-night{background:#eae6ff;color:#3e2b84}.pill-off{background:#ffe0e0;color:#8b1b1b}
      .pill-vac{background:#dff5ff;color:#035f88}.pill-low{background:#fde4ff;color:#7b2d86}
      .pill-perm{background:#e9f0ff;color:#274d9c}.pill-form{background:#efe7ff;color:#5b2d91}
      .pill-ct{background:#e6fff2;color:#0f6a45}
    `;
    document.head.appendChild(s);
  }

  // === API pública usada por mobile.app.js ===
  window.renderContent = function renderContent(DATA, opts = {}) {
    ensureStyle();

    const rows = getRows(DATA);
    const hotel = String(opts.hotel||'').trim();
    const from  = mondayOf(opts.dateFrom || new Date());
    const days  = Array.from({length:7}, (_,i)=> addDays(from, i)).filter(Boolean);

    // Filtra; si una fila no tiene fecha válida, se descarta
    const filtered = rows.filter(r => {
      const h  = String(r.hotel || r.Hotel || r.establecimiento || '').trim();
      const dt = toISO(r.fecha || r.Fecha || r.day || r.date);
      if (!dt) return false;                // <- evita crash por fecha inválida
      return (!hotel || h === hotel) && days.includes(dt);
    });

    // Agrupa por empleado
    const byEmp = new Map();
    for (const r of filtered) {
      const emp = String(r.empleado||r.Empleado||r.nombre||r.name||r.persona||'').trim();
      const dt  = toISO(r.fecha || r.Fecha || r.day || r.date);
      const t   = String(r.turno||r.Turno||r.TipoAusencia||r.ausencia||'').trim();
      if (!emp || !dt) continue;
      if (!byEmp.has(emp)) byEmp.set(emp, {});
      byEmp.get(emp)[dt] = t;
    }

    // destino
    const target = document.getElementById('monthly-summary-container')
                || document.querySelector('#app')
                || document.querySelector('main')
                || document.body;

    // cabecera + tabla
    const ths = ['Empleado','Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((x,i)=>
      i===0 ? `<th>${x}</th>` : `<th>${x}<br>${days[i-1].split('-').reverse().join('/')}</th>`
    ).join('');

    const rowsHtml = [];
    for (const [emp, map] of byEmp) {
      const tds = days.map(d => `<td>${pill(map[d]||'')}</td>`).join('');
      rowsHtml.push(`<tr><td class="emp">${emp}</td>${tds}</tr>`);
    }

    const body = rowsHtml.join('') || `<tr><td colspan="8" class="muted">No hay datos para esa semana.</td></tr>`;

    target.innerHTML = `
      <div class="weekCard">
        <table class="grid">
          <thead><tr>${ths}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    `;
  };
})();
