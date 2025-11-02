;(function () {
  // -------- utilidades --------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const cleanLabel = (s) => {
    if (!s) return s;
    // Quitar mojibake y restos extraños ("¤’", "”„", bytes mal decodificados)
    return String(s)
      .replace(/[\uFFFD\u00A4\u2019\u201D\u201E]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const badge = (txt, type) => {
    const span = document.createElement('span');
    span.className = 'pill ' + (type || 'neutral');
    span.textContent = txt;
    return span;
  };

  const withEmoji = (txt) => {
    const t = (txt || '').toLowerCase();
    if (t.startsWith('mañ')) return 'Mañana';
    if (t.startsWith('tar')) return 'Tarde';
    if (t.startsWith('noc')) return 'Noche 🌙';
    if (t.startsWith('desc')) return 'Descanso';
    if (t.startsWith('baja')) return 'Baja 🤒';
    if (t.startsWith('vac')) return 'Vacaciones 🏖️';
    if (t.startsWith('perm')) return 'Permiso 🗓️';
    if (t.startsWith('form')) return 'Formación 🎓';
    return txt;
  };

  const asText = (v) => {
    if (typeof v === 'string') return withEmoji(cleanLabel(v));
    if (v && typeof v === 'object') {
      // Sustituciones: mantener texto exacto de TipoAusencia y marcar con ↔ si aplica
      const base = withEmoji(cleanLabel(v.TurnoOriginal || ''));
      const tipo = cleanLabel(v.TipoInterpretado || '');
      const suf  = tipo ? ' ' + withEmoji(tipo) : '';
      // Si en data viene marcado como cambio, ya llevará 🔄; si no, lo dejamos como está.
      return (base + suf).trim();
    }
    return '';
  };

  const hasAnyShift = (rowCells) => rowCells.some(c => !!c.textContent && c.textContent !== '—');

  // -------- datos --------
  const DATA = (function () {
    // mobile usa data.js; toleramos varias formas
    const d = window.FULL_DATA || window.DATA || window.dataset || {};
    return d;
  })();

  if (!DATA || !DATA.schedule) {
    $('#app').innerHTML =
      '<p class="hint">No hay datos de turnos. Asegúrate de que <code>data.js</code> está accesible.</p>';
    return;
  }

  // -------- estado --------
  const state = {
    // filtros
    hotel: '',
    empleado: '',
    desde: '',
    hasta: '',
    // navegación por semanas (se calcula según filtro aplicado)
    currentMonday: null,
  };

  // -------- UI: filtros --------
  const openFilters = () => {
    $('#filtersBackdrop').style.display = 'flex';
  };
  const closeFilters = () => {
    $('#filtersBackdrop').style.display = 'none';
  };

  const hotels = [...new Set(DATA.schedule.map(g => g.hotel))].sort((a, b) => a.localeCompare(b, 'es'));
  const selHotel = $('#fHotel');
  selHotel.innerHTML = ['<option value="">— Hotel —</option>']
    .concat(hotels.map(h => `<option value="${h}">${h}</option>`)).join('');

  const selEmpleado = $('#fEmpleado');

  const refreshEmpleados = (hotel) => {
    const set = new Set();
    DATA.schedule
      .filter(g => !hotel || g.hotel === hotel)
      .forEach(g => g.orden_empleados.forEach(e => set.add(e)));
    const opts = ['<option value="">— Empleado —</option>']
      .concat([...set].sort((a, b) => a.localeCompare(b, 'es')).map(e => `<option>${e}</option>`));
    selEmpleado.innerHTML = opts.join('');
  };
  refreshEmpleados('');

  // listeners básicos
  $('#btnFilters').addEventListener('click', openFilters);
  $('#fCerrar').addEventListener('click', closeFilters);

  // Aplicar filtros
  $('#fAplicar').addEventListener('click', () => {
    state.hotel = selHotel.value;
    state.empleado = selEmpleado.value;
    state.desde = $('#fDesde').value || '';
    state.hasta = $('#fHasta').value || '';

    // Calcular lunes inicial si hay "desde"
    if (state.desde) {
      const d = new Date(state.desde + 'T00:00:00');
      const dow = (d.getDay() + 6) % 7; // 0 = lunes
      const monday = new Date(d);
      monday.setDate(d.getDate() - dow);
      state.currentMonday = monday;
    } else {
      state.currentMonday = null;
    }

    render();
    closeFilters();
  });

  // -------- render --------
  const fmtDateES = (d) =>
    d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');

  const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  };

  const mondayOf = (isoYYYYMMDD) => {
    const d = new Date(isoYYYYMMDD + 'T00:00:00');
    const dow = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dow);
    return d;
  };

  const render = () => {
    const app = $('#app');
    app.innerHTML = '';

    // Filtrado por hotel
    let groups = DATA.schedule;
    if (state.hotel) groups = groups.filter(g => g.hotel === state.hotel);

    // Ordenar por semana (lunes ascendente)
    groups = groups.slice().sort((a, b) => a.semana_lunes.localeCompare(b.semana_lunes));

    // Rango de fechas
    const fDesde = state.desde || '';
    const fHasta = state.hasta || '';

    if (state.currentMonday) {
      // Si hay navegación por semanas, reducimos la vista a esa semana
      const target = state.currentMonday.toISOString().slice(0, 10);
      groups = groups.filter(g => g.semana_lunes === target);
    } else if (fDesde) {
      // filtrar por rango (semana incluida si cualquiera de sus 7 días intersecta)
      const d1 = new Date(fDesde + 'T00:00:00');
      const d2 = fHasta ? new Date(fHasta + 'T23:59:59') : addDays(d1, 27); // por defecto ~4 semanas
      groups = groups.filter(g => {
        const monday = mondayOf(g.semana_lunes);
        const sunday = addDays(monday, 6);
        return !(sunday < d1 || monday > d2);
      });
    } else {
      // por defecto, mostrar 4 semanas desde "hoy" (para no cargar eternamente)
      const today = new Date();
      const d2 = addDays(today, 27);
      groups = groups.filter(g => {
        const monday = mondayOf(g.semana_lunes);
        const sunday = addDays(monday, 6);
        return !(sunday < today || monday > d2);
      });
    }

    if (groups.length === 0) {
      app.innerHTML = '<p class="hint">Sin resultados con los filtros actuales.</p>';
      return;
    }

    // Construir tarjetas por semana
    for (const g of groups) {
      const monday = mondayOf(g.semana_lunes);
      const sunday = addDays(monday, 6);

      const card = document.createElement('section');
      card.className = 'week-card';

      const header = document.createElement('div');
      header.className = 'week-head';
      header.innerHTML = `
        <div class="hotel-line">
          <img src="Logo.png" alt="" class="hotel-logo">
          <strong>${g.hotel}</strong> – Semana ${fmtDateES(monday)} → ${fmtDateES(sunday)}
        </div>
      `;
      card.appendChild(header);

      // Tabla
      const table = document.createElement('table');
      table.className = 'grid';

      // Encabezados
      const thead = document.createElement('thead');
      const htr = document.createElement('tr');
      htr.innerHTML = `
        <th style="min-width:140px">Empleado</th>
        <th>Lunes<br><small>${fmtDateES(monday)}</small></th>
        <th>Martes<br><small>${fmtDateES(addDays(monday,1))}</small></th>
        <th>Miércoles<br><small>${fmtDateES(addDays(monday,2))}</small></th>
        <th>Jueves<br><small>${fmtDateES(addDays(monday,3))}</small></th>
        <th>Viernes<br><small>${fmtDateES(addDays(monday,4))}</small></th>
        <th>Sábado<br><small>${fmtDateES(addDays(monday,5))}</small></th>
        <th>Domingo<br><small>${fmtDateES(addDays(monday,6))}</small></th>
      `;
      thead.appendChild(htr);
      table.appendChild(thead);

      // Índices de turnos por fecha+empleado
      const turnsMap = new Map();
      for (const t of g.turnos) {
        turnsMap.set(t.empleado + '|' + t.fecha, t.turno);
      }

      const tbody = document.createElement('tbody');

      // Construir filas según orden_empleados, ocultando quienes no tienen ningún turno esa semana
      for (const emp of g.orden_empleados) {
        if (state.empleado && state.empleado !== emp) continue;

        const row = document.createElement('tr');
        const c0 = document.createElement('td');
        c0.textContent = emp;
        c0.className = 'emp-cell';
        row.appendChild(c0);

        const rowCells = [];
        for (let i = 0; i < 7; i++) {
          const d = addDays(monday, i).toISOString().slice(0, 10);
          const key = emp + '|' + d;
          const raw = turnsMap.get(key);

          const td = document.createElement('td');
          let txt = asText(raw);
          // marcar cambio de turno
          if (typeof raw === 'string' && /🔄/.test(raw)) txt = cleanLabel(raw); // ya venía marcado
          if (typeof raw === 'object' && raw && /🔄/.test(raw.TurnoOriginal || '')) {
            txt += ' 🔄';
          }

          if (txt) {
            const pill = badge(txt, txt.startsWith('Mañana') ? 'morning'
              : txt.startsWith('Tarde') ? 'evening'
              : txt.startsWith('Noche') ? 'night'
              : txt.startsWith('Descanso') ? 'rest'
              : txt.startsWith('Baja') ? 'alert'
              : txt.startsWith('Vacaciones') ? 'vac'
              : 'neutral');
            td.appendChild(pill);
          } else {
            td.textContent = '—';
            td.className = 'dash';
          }

          rowCells.push(td);
          row.appendChild(td);
        }

        if (hasAnyShift(rowCells)) {
          tbody.appendChild(row);
        }
      }

      table.appendChild(tbody);
      card.appendChild(table);
      app.appendChild(card);
    }
  };

  // -------- navegación por semanas --------
  const moveWeek = (delta) => {
    if (!state.currentMonday) {
      // si no hay "desde", fijamos la semana actual
      const today = new Date();
      const dow = (today.getDay() + 6) % 7;
      state.currentMonday = new Date(today);
      state.currentMonday.setDate(today.getDate() - dow);
    }
    state.currentMonday.setDate(state.currentMonday.getDate() + delta * 7);
    // al moverse por semanas, ignoramos fHasta para que no nos lo corte
    render();
  };

  $('#btnPrev').addEventListener('click', () => moveWeek(-1));
  $('#btnNext').addEventListener('click', () => moveWeek(1));
  $('#btnToday').addEventListener('click', () => {
    state.currentMonday = null;
    render();
  });

  // Primer render
  document.addEventListener('DOMContentLoaded', render);
  render();
})();
