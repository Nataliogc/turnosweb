/* mobile.app.js
   Arranque de la vista móvil sin depender de selects (#weeks, #hotelSelect).
   Requiere:
     - data.js              → window.FULL_DATA
     - plantilla_mobile_adapter.js → window.renderContent (adaptador SOLO móvil)
   Opcionales:
     - data.ausencias.js
     - normalize_data.js    → si existe, se usa de forma no bloqueante
     - mobile.patch.js      → parches visuales/texto

   Este archivo NO interfiere con index.html ni con plantilla_adapter_semana.js (escritorio).
*/
(function () {
  'use strict';

  // ---------- utilidades de fecha ----------
  const DAY = 86400000;
  const toISO = (d) => {
    const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return z.toISOString().slice(0, 10);
  };
  const mondayOf = (any) => {
    const d = new Date(any);
    const wd = (d.getDay() + 6) % 7; // lunes = 0
    const m = new Date(d); m.setDate(d.getDate() - wd);
    return toISO(m);
  };
  const sundayOf = (monISO) => {
    const base = new Date(monISO);
    return toISO(new Date(base.getTime() + 6 * DAY));
  };

  // ---------- helper: primer hotel disponible ----------
  function pickFirstHotel(FD) {
    const H = Array.isArray(FD?.hoteles) ? FD.hoteles : [];
    if (H.length) {
      const h0 = H[0];
      return h0.id || h0.codigo || h0.code || h0.nombre || h0.name || '';
    }
    // Inferir desde filas si no hay estructura de hoteles
    const rows = Array.isArray(FD?.rows) ? FD.rows
               : Array.isArray(FD?.data) ? FD.data
               : Array.isArray(FD?.schedule) ? FD.schedule
               : Array.isArray(FD) ? FD
               : [];
    const h = String((rows[0]?.hotel || rows[0]?.Hotel || rows[0]?.establecimiento || '')).trim();
    return h || '';
  }

  // ---------- asegurar contenedor ----------
  function ensureContainer() {
    if (!document.getElementById('monthly-summary-container')) {
      const box = document.createElement('div');
      box.id = 'monthly-summary-container';
      (document.querySelector('main') || document.body).appendChild(box);
    }
  }

  // ---------- render principal (semana actual) ----------
  function renderWeekNow() {
    if (!window.FULL_DATA) {
      console.error('[mobile boot] Falta data.js');
      return;
    }
    if (typeof window.renderContent !== 'function') {
      console.error('[mobile boot] Falta plantilla_mobile_adapter.js');
      return;
    }

    ensureContainer();

    const mon = mondayOf(new Date());
    const sun = sundayOf(mon);
    const hotel = pickFirstHotel(window.FULL_DATA);

    // Si hay normalizador opcional expuesto, úsalo (no bloqueante)
    // p.ej.: window.normalizeTurno(txt) → txt normalizado
    const opts = {
      hotel,
      employee: '',
      dateFrom: mon,
      dateTo: sun
    };

    // Render directo
    try {
      window.renderContent(window.FULL_DATA, opts);
      document.dispatchEvent(new CustomEvent('mobile:rendered', { detail: opts }));
    } catch (e) {
      console.error('[mobile render] error al pintar', e);
    }
  }

  // ---------- re-render si navegas por hash (opcional) ----------
  // Permite forzar otra semana con #yyyy-mm-dd (lunes)
  function renderFromHash() {
    if (!window.FULL_DATA || typeof window.renderContent !== 'function') return;
    const h = (location.hash || '').replace('#', '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(h)) return; // no hay fecha válida
    ensureContainer();
    const mon = h;
    const sun = sundayOf(mon);
    const hotel = pickFirstHotel(window.FULL_DATA);
    const opts = { hotel, employee: '', dateFrom: mon, dateTo: sun };
    try {
      window.renderContent(window.FULL_DATA, opts);
      document.dispatchEvent(new CustomEvent('mobile:rendered', { detail: opts }));
    } catch (e) {
      console.error('[mobile render/hash] error al pintar', e);
    }
  }

  // ---------- bootstrap ----------
  document.addEventListener('DOMContentLoaded', () => {
    // 1) si hay hash con fecha, intenta esa semana
    if ((location.hash || '').startsWith('#20')) {
      renderFromHash();
    } else {
      // 2) por defecto, semana actual
      renderWeekNow();
    }
  });

  // Reaccionar a cambios de hash (opcional)
  window.addEventListener('hashchange', renderFromHash);

  // Re-render defensivo si cambian datos en caliente (poco frecuente)
  window.addEventListener('FULL_DATA:updated', renderWeekNow);
})();
