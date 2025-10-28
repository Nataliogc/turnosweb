/* === PARCHE SEGURO DE FILTROS (app móvil) === */
(function () {
  // Helpers DOM
  const $  = (sel) => document.querySelector(sel);
  const $id = (id) => document.getElementById(id);
  const uniq = (a) => [...new Set(a.filter(Boolean))];

  // -------- Normalización de datos ----------
  function flattenRows(D) {
    const S = Array.isArray(D?.schedule) ? D.schedule : [];
    if (!S.length) return Array.isArray(D?.data) ? D.data : [];
    if (S[0] && Array.isArray(S[0].turnos)) {
      const out = [];
      for (const w of S) {
        const hotel = w.hotel || w.Hotel || w.establecimiento || w?.meta?.hotel || "";
        for (const t of (w.turnos || [])) {
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

  function hotelsFrom(D) {
    if (Array.isArray(D?.hotels) && D.hotels.length) return uniq(D.hotels);
    return uniq(flattenRows(D).map(hotelOf));
  }
  function employeesFrom(D, hotel) {
    if (Array.isArray(D?.employees) && D.employees.length) {
      const arr = hotel ? D.employees.filter(e => (e.hotel||e.Hotel) === hotel) : D.employees;
      return arr.map(e => e.name || e.empleado || e);
    }
    return uniq(flattenRows(D).filter(x => !hotel || hotelOf(x) === hotel).map(nameOf));
  }

  // -------- Render público (lo llama mobile.patch.js) ----------
  window.renderContent = window.renderContent || function renderContent(opts) {
    // Si tu versión ya define renderContent, se respeta. Este es un stub de seguridad.
    const el = $id('app');
    if (!el) return;
    el.innerHTML = el.innerHTML || '<p class="meta">Listo. Abre <b>Filtros</b>, elige Hotel/Rango y pulsa <b>Aplicar</b>.</p>';
  };

  // -------- Filtros (seguros) ----------
  function refreshEmployeeOptions(D, hotel) {
    const empSel = $id('employeeFilter');
    if (!empSel) return;                 // <- evita "is null"
    const list = employeesFrom(D, hotel);
    empSel.innerHTML =
      '<option value="">— Empleado —</option>' +
      list.map(n => `<option value="${n}">${n}</option>`).join('');
  }

  function populateFilters(D) {
    const hotelSel = $id('hotelSelect');
    const empSel   = $id('employeeFilter');
    if (!hotelSel || !empSel) return;    // <- no hay selects en el DOM todavía

    const hs = hotelsFrom(D);
    hotelSel.innerHTML =
      '<option value="">— Hotel —</option>' +
      hs.map(h => `<option value="${h}">${h}</option>`).join('');

    // Primer pintado de empleados (sin hotel o con el seleccionado)
    refreshEmployeeOptions(D, hotelSel.value || "");

    // Repoblar empleados al cambiar hotel
    hotelSel.onchange = () => refreshEmployeeOptions(D, hotelSel.value || "");
  }

  // -------- Arranque cuando el DOM está listo ----------
  function domReady(fn){
    if (document.readyState === 'complete' || document.readyState === 'interactive') fn();
    else document.addEventListener('DOMContentLoaded', fn, { once:true });
  }

  domReady(() => {
    const D = window.FULL_DATA || {};
    populateFilters(D);                  // <- ya existe el DOM; no habrá null
  });
})();
