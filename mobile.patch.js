// mobile.patch.js — Vista APP: drawer de filtros, fechas estables y render
(function () {
  const $ = s => document.querySelector(s);

  // ==== Drawer Filtros ====
  const drawer = $('#filtersDrawer');
  const btnOpen = $('#btnFilters');
  const btnClose = $('#btnCloseFilters');
  const backdrop = drawer?.querySelector('.backdrop');

  function openDrawer() {
    drawer?.classList.remove('hidden');
    drawer?.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
  }
  function closeDrawer() {
    drawer?.classList.add('hidden');
    drawer?.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }
  btnOpen?.addEventListener('click', openDrawer);
  btnClose?.addEventListener('click', closeDrawer);
  backdrop?.addEventListener('click', closeDrawer);
  window.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  // ==== Flatpickr (ES, formato d/M/Y) ====
  try { if (window.flatpickr?.l10ns?.es) flatpickr.localize(flatpickr.l10ns.es); } catch {}
  const fpFrom = flatpickr('#dateFrom', { dateFormat: 'd/M/Y', weekNumbers: true, defaultDate: $('#dateFrom')?.value || undefined });
  const fpTo   = flatpickr('#dateTo',   { dateFormat: 'd/M/Y', weekNumbers: true, defaultDate: $('#dateTo')?.value   || undefined });

  // ==== Render con filtros ====
  function applyFilters() {
    const from = fpFrom.selectedDates?.[0] || null;
    const to   = fpTo.selectedDates?.[0]   || null;

    // Rango seguro si falta uno
    let dFrom = from, dTo = to;
    if (dFrom && !dTo) dTo = new Date(dFrom.getTime() + 31*864e5);
    if (!dFrom && dTo) dFrom = new Date(dTo.getTime()   - 31*864e5);

    if (dFrom) $('#dateFrom').value = fpFrom.formatDate(dFrom, 'd/M/Y');
    if (dTo)   $('#dateTo').value   = fpTo.formatDate(dTo,   'd/M/Y');

    const hotel = $('#hotelSelect')?.value || '';
    const emp   = $('#employeeFilter')?.value || '';

    if (typeof window.renderContent === 'function') {
      window.renderContent({ dateFrom: dFrom, dateTo: dTo, hotel, employee: emp });
    }
  }

  // Botones
  $('#btnApply')?.addEventListener('click', () => { applyFilters(); closeDrawer(); });
  $('#btnPrevW')?.addEventListener('click', () => {
    const f = fpFrom.selectedDates?.[0] || new Date();
    const t = fpTo.selectedDates?.[0]   || new Date(f.getTime() + 30*864e5);
    fpFrom.setDate(new Date(f.getTime() - 7*864e5), true);
    fpTo.setDate(  new Date(t.getTime() - 7*864e5), true);
    applyFilters();
  });
  $('#btnTodayW')?.addEventListener('click', () => {
    const now = new Date();
    fpFrom.setDate(now, true);
    fpTo.setDate(new Date(now.getTime() + 30*864e5), true);
    applyFilters();
  });
  $('#btnNextW')?.addEventListener('click', () => {
    const f = fpFrom.selectedDates?.[0] || new Date();
    const t = fpTo.selectedDates?.[0]   || new Date(f.getTime() + 30*864e5);
    fpFrom.setDate(new Date(f.getTime() + 7*864e5), true);
    fpTo.setDate(  new Date(t.getTime() + 7*864e5), true);
    applyFilters();
  });

  // Al arrancar: primer render
  applyFilters();
})();
