/* mobile.patch.js · pensado para NO tocar plantilla_adapter_semana.js */

(function () {
  "use strict";

  // ---- Utilidades ----
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const fmt = (d) => d.toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' });

  // Estado UI
  const state = {
    hotel: '',
    empleado: '',
    desde: null,
    hasta: null,
    baseMonday: null // lunes de la semana visible
  };

  // Detectar dataset expuesto por data.js
  function getDataset() {
    // soporta varias firmas habituales
    return (
      window.DATA || window.__DATA__ || window.turnos || window.TURNOS || window.dataset || null
    );
  }

  // Detectar API de render en la plantilla (no la cambiamos)
  function getRenderApi() {
    // buscamos funciones conocidas que ya existen en tu adapter
    const api = {};
    api.renderMobile =
      window.renderMobile ||
      (window.Plantilla && (window.Plantilla.renderMobile || window.Plantilla.render)) ||
      window.renderSemanaMobile ||
      window.renderSemana ||
      null;

    api.listHoteles = window.listHoteles || (window.Plantilla && window.Plantilla.listHoteles) || null;
    api.listEmpleados = window.listEmpleados || (window.Plantilla && window.Plantilla.listEmpleados) || null;

    return api;
  }

  // Lunes de una fecha
  function mondayOf(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay(); // 0=domingo … 1=lunes
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff);
    d.setHours(0,0,0,0);
    return d;
  }

  // Semana siguiente/anterior
  function addDays(date, days) {
    const d = new Date(date); d.setDate(d.getDate() + days); return d;
  }

  // Rellenar combos
  function fillCombos(ds) {
    const selHotel = $('#fHotel');
    const selEmp   = $('#fEmpleado');

    // Rellenar hoteles
    const hoteles = (ds.hoteles || ds.Hoteles || []).map(h => (h.nombre || h.Name || h));
    selHotel.innerHTML = `<option value="">— Hotel —</option>` +
      hoteles.map(h => `<option>${h}</option>`).join('');

    // Empleados (única lista global si existe; si no, se filtra por hotel en render)
    const empleados =
      (ds.empleados || ds.Empleados || ds.employees || [])
        .map(e => (e.nombre || e.name || e));

    const uniq = [...new Set(empleados)].sort((a,b)=> a.localeCompare(b,'es'));
    selEmp.innerHTML = `<option value="">— Empleado —</option>` +
      uniq.map(n => `<option>${n}</option>`).join('');
  }

  // Pintar semana móvil mediante la API ya existente
  function paint() {
    const ds = getDataset();
    const api = getRenderApi();
    if (!ds || !api.renderMobile) return;

    // Construir opciones que tu adapter ya entiende (sin romper nada)
    const opts = {
      hotel: state.hotel || null,
      empleado: state.empleado || null,
      desde: state.baseMonday ? new Date(state.baseMonday) : null,
      hasta: state.hasta ? new Date(state.hasta) : null,
      // pista: lunes→domingo
      mondayFirst: true
    };

    // Limpia status
    $('#status')?.remove();

    // Llamada de render (tu adapter decide el DOM)
    try {
      api.renderMobile(ds, opts, $('#root'));
    } catch (e) {
      console.error('Error renderMobile:', e);
    }
  }

  // Eventos UI
  function bindUI() {
    const mask = $('#filtersMask');
    $('#filtersBtn').addEventListener('click', () => { mask.style.display='grid'; });

    $('#closeBtn').addEventListener('click', () => { mask.style.display='none'; });

    $('#applyBtn').addEventListener('click', () => {
      state.hotel = $('#fHotel').value.trim();
      state.empleado = $('#fEmpleado').value.trim();
      const d1 = $('#fDesde').value ? new Date($('#fDesde').value) : new Date();
      const d2 = $('#fHasta').value ? new Date($('#fHasta').value) : null;

      state.baseMonday = mondayOf(d1);
      state.desde = d1;
      state.hasta = d2;

      paint();
      mask.style.display='none';
    });

    // navegadores
    $('#todayBtn').addEventListener('click', () => {
      state.baseMonday = mondayOf(new Date());
      paint();
    });

    $('#prevBtn').addEventListener('click', () => {
      if (!state.baseMonday) state.baseMonday = mondayOf(new Date());
      state.baseMonday = addDays(state.baseMonday, -7);
      paint();
    });

    $('#nextBtn').addEventListener('click', () => {
      if (!state.baseMonday) state.baseMonday = mondayOf(new Date());
      state.baseMonday = addDays(state.baseMonday, 7);
      paint();
    });
  }

  // Esperar data + plantilla y arrancar
  function ready(fn){
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function bootWhenReady() {
    const ds = getDataset();
    const api = getRenderApi();
    if (ds && api.renderMobile) {
      fillCombos(ds);
      state.baseMonday = mondayOf(new Date());
      paint();
      return true;
    }
    return false;
  }

  ready(() => {
    bindUI();

    // Reintentos suaves hasta que data.js y la plantilla estén
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (bootWhenReady() || tries > 40) clearInterval(t);
    }, 100);
  });
})();
