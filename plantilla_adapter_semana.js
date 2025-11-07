/* plantilla_adapter_semana.js
   — Plantilla común (escritorio + móvil)
   — Expone: window.renderContent(data, {hotel, employee, dateFrom, dateTo})
   — No asume que existan controles de escritorio en el DOM.
*/

(function () {
  'use strict';

  // ---------- Utilidades de fecha ----------
  const DAY = 86400000;
  const toISO = d => (typeof d === 'string')
    ? d.slice(0, 10)
    : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const fromISO = s => new Date(s);
  const addDays = (iso, n) => toISO(new Date(fromISO(iso).getTime() + n * DAY));
  const mondayOf = any => {
    const d = (any instanceof Date) ? any : new Date(any);
    const wd = (d.getDay() + 6) % 7;
    return toISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - wd));
  };

  // ---------- Normalizador opcional ----------
  const norm = (txt) => {
    if (!txt) return '';
    // Usa normalize_data.js si está presente
    if (typeof window.normalizeTurno === 'function') return window.normalizeTurno(txt);
    return String(txt).trim();
  };

  // ---------- Renderizador: usa MobileRenderer si existe ----------
  function ensureContainer() {
    let el = document.getElementById('monthly-summary-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'monthly-summary-container';
      (document.querySelector('main') || document.body).appendChild(el);
    }
    return el;
  }

  function renderWithMobileRenderer(target, opts) {
    if (window.MobileRenderer && typeof window.MobileRenderer.renderWeek === 'function') {
      window.MobileRenderer.renderWeek(target, opts);
      return true;
    }
    return false;
  }

  // Fallback de cortesía si no hubiera MobileRenderer
  function renderFallback(target, data, opts) {
    target.innerHTML = '';
    const info = document.createElement('pre');
    info.style.whiteSpace = 'pre-wrap';
    info.style.font = '14px/1.4 system-ui, Segoe UI, Arial';
    info.style.color = '#334';
    info.style.padding = '12px';
    info.style.background = '#f7fafc';
    info.style.border = '1px solid #e5eef5';
    info.style.borderRadius = '10px';
    info.textContent =
`No se encontró MobileRenderer.renderWeek().
Mostrando datos mínimos para depurar:

Hotel: ${opts.hotel || '(auto)'}
Desde: ${opts.dateFrom}  →  Hasta: ${opts.dateTo}

Sugerencia: Mantén mobile.patch.js en el proyecto.`;
    target.appendChild(info);
  }

  // ---------- API: renderContent ----------
  window.renderContent = function renderContent(data, options) {
    const target = ensureContainer();

    // Normaliza opciones
    const opts = Object.assign({
      hotel: '',
      employee: '',
      dateFrom: mondayOf(new Date()),
      dateTo: addDays(mondayOf(new Date()), 6),
      normalize: norm,
      hideEmptyEmployees: true
    }, options || {});

    // Intenta render móvil unificado (bonito + compatible)
    const ok = renderWithMobileRenderer(target, {
      weekStartISO: mondayOf(opts.dateFrom),
      hotel: opts.hotel,
      empleado: opts.employee,
      from: opts.dateFrom,
      to: opts.dateTo,
      normalize: opts.normalize,
      hideEmptyEmployees: opts.hideEmptyEmployees
    });

    // Si no hay renderer móvil, usa fallback
    if (!ok) {
      renderFallback(target, data, opts);
    }
  };

  // ======================================================================
  // =====================  LÓGICA SOLO ESCRITORIO  ========================
  // ======================================================================

  // Poblar selects solo si existen en el DOM (escritorio)
  function populateFiltersIfPresent() {
    const hotelSelect = document.getElementById('hotelSelect');
    const weeksSelect = document.getElementById('weeks');
    if (!hotelSelect || !weeksSelect) return; // ← En móvil no hay UI

    // Hoteles desde FULL_DATA
    const hoteles = Array.isArray(window.FULL_DATA?.hoteles) ? window.FULL_DATA.hoteles : [];
    const hotelOpts = hoteles.map(h => {
      const val = h.id || h.codigo || h.code || h.nombre || h.name || '';
      const txt = h.nombre || h.name || h.codigo || val || 'Hotel';
      return `<option value="${String(val)}">${txt}</option>`;
    }).join('');
    hotelSelect.innerHTML = hotelOpts || '<option value="">(Sin hoteles)</option>';

    // Semanas (4 hacia atrás + 8 hacia adelante)
    const base = new Date();
    const baseMon = new Date(fromISO(mondayOf(base)));
    const options = [];
    for (let k = -4; k <= 8; k++) {
      const d = new Date(baseMon); d.setDate(d.getDate() + k * 7);
      const iso = toISO(d);
      const end = addDays(iso, 6);
      options.push(`<option value="${iso}">Semana ${iso} → ${end}</option>`);
    }
    weeksSelect.innerHTML = options.join('');

    // Botón aplicar si está
    const btnApply = document.getElementById('btnApply');
    if (btnApply) {
      btnApply.addEventListener('click', () => {
        const hotel = hotelSelect.value || '';
        const weekStart = weeksSelect.value || mondayOf(new Date());
        const weekEnd = addDays(weekStart, 6);
        window.renderContent(window.FULL_DATA, {
          hotel,
          employee: '',
          dateFrom: weekStart,
          dateTo: weekEnd
        });
      });
    }
  }

  // Hook de escritorio: solo si existe la UI
  document.addEventListener('DOMContentLoaded', () => {
    // Si no hay controles, no auto-inicializamos (estamos en móvil)
    const hotelSelect = document.getElementById('hotelSelect');
    const weeks = document.getElementById('weeks');
    if (!hotelSelect || !weeks) return;

    populateFiltersIfPresent();

    // Render inicial (semana actual) para escritorio
    const weekStart = mondayOf(new Date());
    const weekEnd = addDays(weekStart, 6);
    // Primer hotel (si existe)
    const h0 = (Array.isArray(FULL_DATA?.hoteles) ? FULL_DATA.hoteles : [])[0] || {};
    const hotel = h0.id || h0.codigo || h0.code || h0.nombre || h0.name || '';

    window.renderContent(window.FULL_DATA, {
      hotel,
      employee: '',
      dateFrom: weekStart,
      dateTo: weekEnd
    });
  });

})();
