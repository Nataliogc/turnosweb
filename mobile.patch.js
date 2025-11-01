// mobile.patch.js — robusto: UI siempre activa y sincroniza cuando el motor esté listo

(function () {
  const $  = s => document.querySelector(s);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

  // === Compat helpers =======================================================
  const getData = () => window.FULL_DATA || window.DATA || window.__DATA__;
  const call = (names, ...args) => {
    for (const n of names) {
      const fn = window[n];
      if (typeof fn === 'function') return fn(...args);
    }
  };
  const has = names => names.some(n => typeof window[n] === 'function');

  // input date  YYYY-MM-DD  ↔  motor dd/mm/aaaa
  const toMotor   = v => !v ? '' : v.split('-').reverse().join('/');     // 2025-11-02 → 02/11/2025
  const fromMotor = v => !v ? '' : v.split('/').reverse().join('-');     // 02/11/2025 → 2025-11-02

  // === Modal ================================================================
  function openFilters()  { $('#overlay')?.classList.add('show'); $('#filters')?.classList.add('show'); }
  function closeFilters() { $('#overlay')?.classList.remove('show'); $('#filters')?.classList.remove('show'); }

  // === Empleados (fallback local si el motor no lo hace) ====================
  function buildEmployeeList(data, hotel) {
    if (!data || !hotel || !data[hotel]) return [];
    const set = new Set();
    Object.values(data[hotel]).forEach(semana => {
      const empleados = (semana && semana.empleados) || (semana && semana.Employees) || {};
      Object.keys(empleados).forEach(n => set.add(n));
    });
    return Array.from(set).sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
  }

  function fillHotelSelect(data) {
    const sel = $('#fHotel'); if (!sel) return;
    sel.innerHTML = '';
    const o0 = new Option('— Hotel —', '');
    sel.appendChild(o0);

    // Hoteles conocidos en tu dataset
    const keys = Object.keys(data || {});
    const preferred = ['Cumbria Spa&Hotel', 'Sercotel Guadiana'];
    const ordered = preferred.concat(keys.filter(k => !preferred.includes(k)));
    ordered.forEach(k => { if (data && data[k]) sel.appendChild(new Option(k, k)); });
  }

  function fillEmployeeSelect(list) {
    const sel = $('#fEmp'); if (!sel) return;
    const keep = sel.value;
    sel.innerHTML = '';
    sel.appendChild(new Option('— Empleado —', ''));
    (list || []).forEach(n => sel.appendChild(new Option(n, n)));
    if (keep) sel.value = keep;
  }

  // === Sincronización con el motor =========================================
  let synced = false;
  function trySync() {
    const data = getData();
    const motorReady = has(['applyFilters','aplicarFiltros']) &&
                       has(['injectNav','navegarSemana']) &&
                       has(['currentFilters','getFiltrosActuales']);
    // Poblar hoteles cuando tengamos data
    if (data && !$('#fHotel').options?.length) fillHotelSelect(data);

    if (!motorReady) return; // seguimos intentando cada 120ms
    if (synced)     return;

    // Reflejar filtros actuales (si los hay)
    try {
      const f = call(['currentFilters','getFiltrosActuales']);
      if (f) {
        if (f.hotel)     $('#fHotel').value = f.hotel;
        if (f.employee)  $('#fEmp').value   = f.employee;
        if (f.dateFrom)  $('#fFrom').value  = fromMotor(f.dateFrom);
        if (f.dateTo)    $('#fTo').value    = fromMotor(f.dateTo);
      }
    } catch {}

    // Lista de empleados al cambiar hotel (fallback si el motor no la provee)
    on($('#fHotel'), 'change', () => {
      try {
        if (typeof window.refreshEmployeeOptions === 'function') {
          window.refreshEmployeeOptions(getData(), call(['currentFilters','getFiltrosActuales']) || {});
        } else {
          fillEmployeeSelect(buildEmployeeList(getData(), $('#fHotel').value));
        }
      } catch {}
    });

    synced = true;
  }

  // === UI: listeners inmediatos (funcionan aunque el motor no esté listo) ===
  function bindUI() {
    // Abrir/cerrar modal
    on($('#openFilters'), 'click', openFilters);
    on($('#close'),       'click', closeFilters);
    on($('#overlay'),     'click', closeFilters);

    // Aplicar: si el motor no está aún, simplemente cierra; cuando esté listo, el usuario vuelve a aplicar.
    on($('#apply'), 'click', () => {
      const f = {
        hotel:    $('#fHotel')?.value || '',
        employee: $('#fEmp')?.value   || '',
        dateFrom: toMotor($('#fFrom')?.value || ''),
        dateTo:   toMotor($('#fTo')?.value   || '')
      };
      try { call(['applyFilters','aplicarFiltros'], f); } catch {}
      $('#hint')?.remove();
      closeFilters();
    });

    // Navegación: soporta varios nombres
    const callNav = (delta, today=false) => {
      try { call(['injectNav','navegarSemana'], delta, today); } catch {}
    };
    on($('#prevW'),  'click', () => callNav(-1));
    on($('#nextW'),  'click', () => callNav(+1));
    on($('#todayW'), 'click', () => callNav(0, true));
  }

  // === Arranque =============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindUI);
  } else {
    bindUI();
  }

  // Reintentos suaves para sincronizar con el motor/datos
  const t = setInterval(() => {
    trySync();
    if (synced && $('#fHotel').options.length) clearInterval(t);
  }, 120);

  // Primer pintado razonable si el motor expone navegación
  const kick = setInterval(() => {
    if (has(['injectNav','navegarSemana'])) {
      try { call(['injectNav','navegarSemana'], 0, true); } catch {}
      clearInterval(kick);
    }
  }, 200);
})();
