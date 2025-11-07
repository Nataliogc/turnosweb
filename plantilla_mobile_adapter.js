/* plantilla_mobile_adapter.js — Adaptador SOLO móvil, por hotel + fallback semana */
(function () {
  'use strict';

  // ---------- utilidades de fecha seguras ----------
  const DAY = 86400000;
  const toISO = (d)=>{
    const dt = d instanceof Date ? d : new Date(d);
    if (isNaN(dt)) return '';
    const z = new Date(dt.getTime() - dt.getTimezoneOffset()*60000);
    return z.toISOString().slice(0,10);
  };
  const fromISO = (s)=> new Date(s);
  const addDays = (iso, n)=> toISO(new Date(fromISO(iso).getTime()+n*DAY));
  const mondayOf = (any)=>{
    const base = any ? new Date(any) : new Date();
    const wd = (base.getDay()+6)%7;
    const m = new Date(base); m.setDate(base.getDate()-wd);
    return toISO(m);
  };

  // ---------- lectura flexible ----------
  function flatFromFullData(D){
    const out=[];
    const H = Array.isArray(D?.hoteles)? D.hoteles : [];
    for(const h of H){
      const personas = Array.isArray(h.personas||h.empleados)? (h.personas||h.empleados) : [];
      for(const p of personas){
        const map = p.turnos || p.shifts || {};
        for(const [fecha, turno] of Object.entries(map)){
          out.push({hotel: h.nombre||h.codigo||h.id||'', empleado: p.nombre||p.name||'', fecha, turno});
        }
      }
    }
    return out;
  }
  function getRows(D){
    if (Array.isArray(D)) return D;
    if (Array.isArray(D?.rows)) return D.rows;
    if (Array.isArray(D?.data)) return D.data;
    if (Array.isArray(window.SCHEDULE_FLAT)) return window.SCHEDULE_FLAT; // si existe de tu normalizador
    const f = flatFromFullData(D||window.FULL_DATA||{});
    return f;
  }

  // ---------- logos ----------
  const LOGO_BY_NAME = (name)=>{
    if (/cumbria/i.test(name)) return 'img/cumbria.jpg';
    if (/guadiana/i.test(name)) return 'img/guadiana.jpg';
    return 'img/turnos_icon.png';
  };

  // ---------- UI ----------
  function pill(txt){
    const t=String(txt||'').trim(), l=t.toLowerCase();
    let cls='pill';
    if(l.startsWith('mañana'))cls+=' pill-am';
    else if(l.startsWith('tarde'))cls+=' pill-pm';
    else if(l.startsWith('noche'))cls+=' pill-night';
    else if(l.startsWith('descanso'))cls+=' pill-off';
    else if(l.startsWith('vacaciones'))cls+=' pill-vac';
    else if(l.startsWith('baja'))cls+=' pill-low';
    else if(l.startsWith('permiso'))cls+=' pill-perm';
    else if(l.startsWith('formación'))cls+=' pill-form';
    else if(l.startsWith('c/t'))cls+=' pill-ct';
    return t?`<span class="${cls}">${t}</span>`:'<span class="muted">—</span>';
  }
  function ensureStyle(){
    if (document.getElementById('mobile-inline-style')) return;
    const s=document.createElement('style'); s.id='mobile-inline-style';
    s.textContent=`
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
      .pill-ct{background:#e6fff2;color:#0f6a45}`;
    document.head.appendChild(s);
  }

  // ---------- API pública ----------
  window.MobileTemplate = {
    hotelsList(DATA){
      const rows = getRows(DATA);
      return [...new Set(rows.map(r => String(r.hotel||r.Hotel||r.establecimiento||'').trim()).filter(Boolean))].sort();
    },

    /**
     * renderContent(DATA, {hotel:'', dateFrom: 'YYYY-MM-DD'})
     * Si la semana está vacía, cae a la primera semana presente en datos.
     */
    renderContent(DATA, opts={}){
      ensureStyle();
      const rows = getRows(DATA);
      const container = document.getElementById('monthly-summary-container') || document.body;

      // Semanas disponibles
      const allDates = rows.map(r => toISO(r.fecha||r.Fecha||r.day||r.date)).filter(Boolean).sort();
      let monday = mondayOf(opts.dateFrom || new Date());
      const daysThis = new Set(Array.from({length:7}, (_,i)=> addDays(monday,i)));

      // ¿Hay datos en la semana elegida?
      const hasWeek = rows.some(r => daysThis.has(toISO(r.fecha||r.Fecha||r.day||r.date)));
      if (!hasWeek && allDates.length){
        // caer a primera semana con datos
        monday = mondayOf(allDates[0]);
      }
      const days = Array.from({length:7}, (_,i)=> addDays(monday,i));

      const hotelsAll = this.hotelsList(DATA);
      const hotels = (opts.hotel && opts.hotel.trim()) ? [opts.hotel.trim()] : hotelsAll;

      // cabecera tabla
      const headers = ['Empleado','Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((x,i)=>
        i===0 ? `<th>${x}</th>` : `<th>${x}<br>${days[i-1].split('-').reverse().join('/')}</th>`
      ).join('');

      container.innerHTML = '';
      for (const hName of hotels){
        const filt = rows.filter(r=>{
          const hotel = String(r.hotel||r.Hotel||r.establecimiento||'').trim();
          const dt = toISO(r.fecha||r.Fecha||r.day||r.date);
          if (!dt) return false;
          const okHotel = !hName ? true : (hotel === hName);
          return okHotel && days.includes(dt);
        });

        const byEmp = new Map();
        for (const r of filt){
          const emp = String(r.empleado||r.Empleado||r.nombre||r.name||r.persona||'').trim();
          const dt  = toISO(r.fecha||r.Fecha||r.day||r.date);
          const t   = String(r.turno||r.Turno||r.TipoAusencia||r.ausencia||'').trim();
          if (!emp || !dt) continue;
          if (!byEmp.has(emp)) byEmp.set(emp, {});
          byEmp.get(emp)[dt] = t;
        }

        const logo = LOGO_BY_NAME(hName||'');
        const rng  = `${days[0].split('-').reverse().join('/')} → ${days[6].split('-').reverse().join('/')}`;

        const rowsHtml = [];
        for (const [emp, map] of byEmp){
          const tds = days.map(d => `<td>${pill(map[d]||'')}</td>`).join('');
          rowsHtml.push(`<tr><td class="emp">${emp}</td>${tds}</tr>`);
        }
        const body = rowsHtml.join('') || `<tr><td colspan="8" class="muted">No hay datos para esta semana.</td></tr>`;

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
                <tbody>${body}</tbody>
              </table>
            </div>
          </section>`;
        container.insertAdjacentHTML('beforeend', card);
      }

      if (!hotels.length){
        container.innerHTML = `<section class="weekGroup"><div class="weekCard"><div class="muted">No se han detectado hoteles en los datos.</div></div></section>`;
      }

      return {monday, hotelsAll};
    }
  };
})();
