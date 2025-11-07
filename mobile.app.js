/* mobile.app.js
   — Arranque seguro para vista móvil
   — No depende de selects de escritorio (#weeks, #hotelSelect)
*/

(function () {
  'use strict';

  // utilidades de fecha
  const DAY = 86400000;
  const iso = d => {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  };
  const mondayOf = (any) => {
    const d = (any instanceof Date) ? any : new Date(any);
    const wd = (d.getDay() + 6) % 7;
    return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() - wd));
  };
  const addDays = (isoStr, n) => {
    const d = new Date(isoStr);
    d.setDate(d.getDate() + n);
    return iso(d);
  };

  // comprobaciones mínimas
  if (!window.FULL_DATA) {
    console.error('[mobile boot] Falta data.js');
    return;
  }
  if (typeof window.renderContent !== 'function') {
    console.error('[mobile boot] Falta plantilla_adapter_semana.js');
    return;
  }

  // calcular semana actual (lunes a domingo)
  const now = new Date();
  const weekStart = mondayOf(now);
  const weekEnd = addDays(weekStart, 6);

  // primer hotel disponible
  const hoteles = Array.isArray(FULL_DATA?.hoteles) ? FULL_DATA.hoteles : [];
  const h0 = hoteles[0] || {};
  const hotel = h0.id || h0.codigo || h0.code || h0.nombre || h0.name || '';

  // asegurar contenedor (por si el layout móvil no lo trae)
  if (!document.getElementById('monthly-summary-container')) {
    const box = document.createElement('div');
    box.id = 'monthly-summary-container';
    (document.querySelector('main') || document.body).appendChild(box);
  }

  // render directo
  window.renderContent(window.FULL_DATA, {
    hotel,
    employee: '',
    dateFrom: weekStart,
    dateTo: weekEnd
  });

  // Navegación por botones (opcional si existen en móvil)
  function nav(deltaWeeks) {
    const start = new Date(weekStart);
    start.setDate(start.getDate() + deltaWeeks * 7);
    const s = iso(start);
    window.renderContent(window.FULL_DATA, {
      hotel,
      employee: '',
      dateFrom: s,
      dateTo: addDays(s, 6)
    });
  }

  // Hooks si existen botones en el header móvil
  const btnPrev = document.querySelector('[data-nav="prev-week"]');
  const btnNext = document.querySelector('[data-nav="next-week"]');
  const btnToday = document.querySelector('[data-nav="today"]');

  if (btnPrev) btnPrev.addEventListener('click', () => nav(-1));
  if (btnNext) btnNext.addEventListener('click', () => nav(+1));
  if (btnToday) btnToday.addEventListener('click', () => {
    const s = mondayOf(new Date());
    window.renderContent(window.FULL_DATA, {
      hotel,
      employee: '',
      dateFrom: s,
      dateTo: addDays(s, 6)
    });
  });

})();
