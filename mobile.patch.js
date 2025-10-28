// mobile.patch.js — Patch de APP móvil: filtros, fechas y render estable
// Requiere que existan estos IDs en el HTML:
// #dateFrom, #dateTo, #btnApply, #btnPrevW, #btnTodayW, #btnNextW, #hotelSelect, #employeeFilter
// Necesita flatpickr + l10n ES cargados antes.

(function () {
  const $ = s => document.querySelector(s);

  // Estado del filtro
  const state = { from: null, to: null };

  // Asegurar locale ES
  try { if (window.flatpickr && window.flatpickr.l10ns && window.flatpickr.l10ns.es) {
    flatpickr.localize(flatpickr.l10ns.es);
  }} catch(e){}

  // Init pickers (lunes como primero, formato d/M/Y)
  const fpFrom = flatpickr('#dateFrom', {
    locale: 'es',
    dateFormat: 'd/M/Y',
    weekNumbers: true,
    defaultDate: $('#dateFrom')?.value || undefined
  });
  const fpTo = flatpickr('#dateTo', {
    locale: 'es',
    dateFormat: 'd/M/Y',
    weekNumbers: true,
    defaultDate: $('#dateTo')?.value || undefined
  });

  function applyFilters() {
    state.from = fpFrom.selectedDates?.[0] || null;
    state.to   = fpTo.selectedDates?.[0]   || null;

    // Ventana segura si falta un extremo
    if (state.from && !state.to)   state.to   = new Date(state.from.getTime() + 31*864e5);
    if (!state.from && state.to)   state.from = new Date(state.to.getTime()   - 31*864e5);

    // Reflejar en inputs (formato visible)
    if (state.from) $('#dateFrom').value = fpFrom.formatDate(state.from, 'd/M/Y');
    if (state.to)   $('#dateTo').value   = fpTo.formatDate(state.to,   'd/M/Y');

    // Render (usa el adaptador ya existente)
    if (typeof window.renderContent === 'function') {
      window.renderContent({
        dateFrom: state.from,
        dateTo: state.to,
        hotel: $('#hotelSelect')?.value || '',
        employee: $('#employeeFilter')?.value || ''
      });
    }
  }

  // Botón "Aplicar"
  $('#btnApply')?.addEventListener('click', applyFilters);

  // Navegación: semana anterior / hoy / siguiente
  function shift(days) {
    const from = fpFrom.selectedDates?.[0] || new Date();
    const to   = fpTo.selectedDates?.[0]   || new Date(from.getTime() + 30*864e5);
    fpFrom.setDate(new Date(from.getTime() + days*864e5), true);
    fpTo.setDate(  new Date(to.getTime()   + days*864e5), true);
    applyFilters();
  }
  $('#btnPrevW')?.addEventListener('click', () => shift(-7));
  $('#btnTodayW')?.addEventListener('click', () => {
    const now = new Date();
    fpFrom.setDate(now, true);
    fpTo.setDate(new Date(now.getTime() + 30*864e5), true);
    applyFilters();
  });
  $('#btnNextW')?.addEventListener('click', () => shift(+7));

  // Primer render con lo que haya
  applyFilters();
})();
