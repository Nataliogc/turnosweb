// mobile.renderer.js — Fallback de render para APP si el adapter no define renderContent
(function () {
  if (typeof window.renderContent === "function") return; // el adapter ya lo pone, no hacemos nada

  const $ = s => document.querySelector(s);

  function unique(a){ return [...new Set(a.filter(Boolean))]; }
  function getSchedule(){
    const D = window.FULL_DATA || {};
    return Array.isArray(D.schedule) ? D.schedule
         : Array.isArray(D.data)     ? D.data
         : [];
  }
  function getHotels(){
    const S = getSchedule();
    const H = unique(S.map(x => x.hotel || x.Hotel || x.establecimiento || x?.meta?.hotel));
    return H.length ? H : (Array.isArray(window.FULL_DATA?.hotels) ? window.FULL_DATA.hotels : []);
  }

  function fmt(d){
    if (!d) return "";
    try {
      const dd = (d instanceof Date) ? d : new Date(d);
      return dd.toLocaleDateString("es-ES", { day:"2-digit", month:"short", year:"numeric" });
    } catch { return String(d); }
  }

  // Render minimal para verificar datos
  window.renderContent = function renderContent(opts = {}) {
    const root = $("#app");
    if (!root) return;

    const S = getSchedule();
    const hotels = getHotels();
    const filtered = S.filter(r => {
      const h = r.hotel || r.Hotel || r.establecimiento || r?.meta?.hotel || "";
      if (opts.hotel && h !== opts.hotel) return false;
      const d = r.fecha || r.date || r.dia || r.day || r?.meta?.fecha;
      if (opts.dateFrom && d && new Date(d) < new Date(opts.dateFrom)) return false;
      if (opts.dateTo   && d && new Date(d) > new Date(opts.dateTo))   return false;
      if (opts.employee){
        const n = r.empleado || r.employee || r.nombre || r.name || r.persona || "";
        if (n !== opts.employee) return false;
      }
      return true;
    });

    root.innerHTML = `
      <div class="card" style="background:#151a20;color:#e8eef6;border:1px solid #29313a;border-radius:12px;padding:16px">
        <div style="font-weight:700;margin-bottom:8px">APP · Render básico</div>
        <div style="font-size:14px;opacity:.8;margin-bottom:12px">
          Registros totales: <b>${S.length}</b> · Filtrados: <b>${filtered.length}</b><br>
          Hoteles: <b>${hotels.join(" · ") || "(desconocidos)"}</b><br>
          Rango: ${fmt(opts.dateFrom)} — ${fmt(opts.dateTo)} · Hotel: <b>${opts.hotel || "—"}</b> · Empleado: <b>${opts.employee || "—"}</b>
        </div>
        <div style="display:grid;gap:8px;max-height:55vh;overflow:auto">
          ${filtered.slice(0,100).map(r => {
            const h = r.hotel || r.Hotel || r.establecimiento || r?.meta?.hotel || "—";
            const n = r.empleado || r.employee || r.nombre || r.name || r.persona || "—";
            const d = r.fecha || r.date || r.dia || r.day || r?.meta?.fecha || "—";
            const t = r.turno || r.shift || r.tramo || r?.meta?.turno || "—";
            return `<div style="display:flex;gap:8px;align-items:center;background:#0e1318;border:1px solid #232b34;border-radius:10px;padding:8px 10px">
                      <span style="min-width:84px;opacity:.8">${fmt(d)}</span>
                      <span style="min-width:160px">${h}</span>
                      <span style="min-width:160px">${n}</span>
                      <span style="padding:.15rem .5rem;border-radius:999px;background:#263445">${t}</span>
                    </div>`;
          }).join("") || `<div style="opacity:.7">No hay datos dentro de los filtros.</div>`}
        </div>
      </div>
    `;
  };
})();
