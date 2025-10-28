/* ===== APP MÓVIL — motor robusto ===== */
(function(){
  "use strict";

  const MS = 864e5;
  const WEEKS_DEFAULT = 4;

  const $  = sel => document.querySelector(sel);
  const $id= id  => document.getElementById(id);

  const monday = (d) => {
    const x = new Date(d); const day = (x.getDay()+6)%7;
    x.setHours(0,0,0,0); return new Date(x.getTime()-day*MS);
  };
  const addDays = (d,n)=> new Date(new Date(d).getTime()+n*MS);

  // === Normalización ===
  function normalize(D){
    const S = Array.isArray(D?.schedule) ? D.schedule : [];
    if (!S.length) return Array.isArray(D?.data) ? D.data : [];
    if (S[0] && Array.isArray(S[0].turnos)){
      const out = [];
      for (const w of S){
        const hotel = w.hotel || w.Hotel || w.establecimiento || w?.meta?.hotel || "";
        for (const t of (w.turnos||[])){
          out.push({
            hotel,
            empleado: t.empleado || t.employee || t.nombre || t.name || t.persona || "",
            fecha:    t.fecha    || t.date    || t.dia   || t.day   || t?.meta?.fecha || "",
            turno:    t.turno    || t.shift   || t.tramo || t?.meta?.turno || ""
          });
        }
      }
      return out;
    }
    return S;
  }
  const hotelOf = r => r.hotel || r.Hotel || r.establecimiento || r?.meta?.hotel || "";
  const nameOf  = r => r.empleado || r.employee || r.nombre || r.name || r.persona || "";
  const uniq = a => [...new Set(a.filter(Boolean))];

  // === Estado ===
  const STATE = {
    rows: [],
    from: monday(new Date()),
    to:   addDays(monday(new Date()), 7*WEEKS_DEFAULT - 1),
    hotel: "",
    empleado: ""
  };

  // === Render ===
  function pill(s){
    s = String(s||'').toLowerCase();
    if (s.includes('mañana')||s.includes('manana')) return `<span class="pill pill-m">Mañana</span>`;
    if (s.includes('tarde'))                      return `<span class="pill pill-t">Tarde</span>`;
    if (s.includes('noche'))                      return `<span class="pill pill-n">Noche 🌙</span>`;
    if (s.includes('descanso'))                   return `<span class="pill pill-x">Descanso</span>`;
    return s||'—';
  }
  const dayLbl = d => { try { return new Date(d).toLocaleDateString('es-ES',{weekday:'short', day:'2-digit'});} catch { return d||'' } };

  function render(){
    const app = $id('app');
    if (!app){ return; }

    const inRange = r => {
      const ds = r.fecha || r.date || r.dia || r.day || r?.meta?.fecha || "";
      const d  = ds ? new Date(ds) : null;
      return (!d || (d >= STATE.from && d <= STATE.to))
          && (!STATE.hotel    || hotelOf(r) === STATE.hotel)
          && (!STATE.empleado || nameOf(r)  === STATE.empleado);
    };

    const rows = STATE.rows.filter(inRange);
    const fechas = uniq(rows.map(r=>r.fecha||r.date||r.dia||r.day||r?.meta?.fecha)).sort((a,b)=>new Date(a)-new Date(b));

    const byHotel = {};
    for (const r of rows){
      const h = hotelOf(r) || '—';
      const n = nameOf(r)  || '—';
      const f = r.fecha || r.date || r.dia || r.day || r?.meta?.fecha || '';
      const t = r.turno || r.shift || r.tramo || r?.meta?.turno || '';
      (byHotel[h]??={}); (byHotel[h][n]??={}); byHotel[h][n][f]=t;
    }

    let html = '';
    for (const [h, emp] of Object.entries(byHotel)){
      html += `
        <div class="row-card">
          <table class="grid-week">
            <thead>
              <tr>
                <th style="min-width:180px">${h}</th>
                ${fechas.map(f=>`<th>${dayLbl(f)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${Object.keys(emp).sort().map(n=>`
                <tr>
                  <td style="text-align:left"><strong>${n}</strong></td>
                  ${fechas.map(f=>`<td>${pill(emp[n][f])}</td>`).join('')}
                </tr>`).join('')}
            </tbody>
          </table>
        </div>`;
    }

    app.innerHTML = html || `<p class="meta">No hay datos para mostrar con los filtros seleccionados.</p>`;
  }

  // === Filtros UI ===
  function populateFilters(){
    const D = window.FULL_DATA || {};
    const hotelSel = $id('hotelSelect');
    const empSel   = $id('employeeFilter');
    if (!hotelSel || !empSel) return;

    const hotels = uniq(STATE.rows.map(hotelOf));
    hotelSel.innerHTML = '<option value="">— Hotel —</option>' + hotels.map(h=>`<option>${h}</option>`).join('');
    const refreshEmp = () => {
      const list = uniq(STATE.rows.filter(r => !hotelSel.value || hotelOf(r)===hotelSel.value).map(nameOf));
      empSel.innerHTML = '<option value="">— Empleado —</option>' + list.map(n=>`<option>${n}</option>`).join('');
    };
    refreshEmp();
    hotelSel.onchange = refreshEmp;

    // Fechas iniciales en el panel
    const toISO = d => new Date(d).toISOString().slice(0,10);
    $id('dateFrom').value = toISO(STATE.from);
    $id('dateTo').value   = toISO(STATE.to);
  }

  function attachUI(){
    // Botones superiores
    $id('btnPrev')?.addEventListener('click', ()=>{ STATE.from = addDays(STATE.from,-7); STATE.to = addDays(STATE.to,-7); render();});
    $id('btnNext')?.addEventListener('click', ()=>{ STATE.from = addDays(STATE.from, 7); STATE.to = addDays(STATE.to, 7); render();});
    $id('btnToday')?.addEventListener('click',()=>{ STATE.from = monday(new Date()); STATE.to = addDays(STATE.from, 7*WEEKS_DEFAULT-1); render();});

    // Filtros / dialog
    const dlg = $id('dlg');
    $id('btnFilters')?.addEventListener('click', ()=>{ dlg?.showModal(); });
    $id('btnApply')?.addEventListener('click', (ev)=>{
      ev.preventDefault();
      const hotel = $id('hotelSelect')?.value || "";
      const emp   = $id('employeeFilter')?.value || "";
      const df    = $id('dateFrom')?.value;
      const dt    = $id('dateTo')?.value;
      STATE.hotel    = hotel;
      STATE.empleado = emp;
      STATE.from = df ? new Date(df) : STATE.from;
      STATE.to   = dt ? new Date(dt) : STATE.to;
      dlg?.close();
      render();
    });
  }

  // === Arranque ===
  window.addEventListener('DOMContentLoaded', ()=>{
    try{
      STATE.rows = normalize(window.FULL_DATA || {});
      // default: semana actual + 3
      STATE.from = monday(new Date());
      STATE.to   = addDays(STATE.from, 7*WEEKS_DEFAULT - 1);

      populateFilters(); // seguro si existen
      attachUI();
      render();
    }catch(e){
      const app = $id('app');
      if (app) app.innerHTML = `<p class="meta">No se pudo iniciar la APP: ${e?.message||e}</p>`;
      console.error('[APP] boot error', e);
    }
  });

  // Por compatibilidad: si alguien llama explícitamente
  window.renderContent = function(){ render(); };
})();
