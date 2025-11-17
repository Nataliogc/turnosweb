/* plantilla_mobile_adapter.js
   Adaptador para versión móvil (robusto):
   - Usa window.FULL_DATA (mismo formato que index/live)
   - Filtra por HOTEL y por FECHA real de cada turno
   - No depende de s.semana_lunes
   - Si en esa semana no hay turnos para ese hotel → tabla vacía
*/
window.MobileAdapter = (function () {
  const pad = n => String(n).padStart(2, "0");

  // Normaliza cualquier cosa a clave "YYYY-MM-DD" o null
  function normalizeDateKey(value) {
    if (!value) return null;

    // 1) Ya en formato ISO simple
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    // 2) Formato español dd/mm/aaaa
    const m = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
      if (!isNaN(d.getTime())) {
        return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
      }
    }

    // 3) Date o cadena parseable
    if (value instanceof Date || typeof value === "string" || typeof value === "number") {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
        return `${x.getUTCFullYear()}-${pad(x.getUTCMonth()+1)}-${pad(x.getUTCDate())}`;
      }
    }

    return null;
  }

  function normalizeHotelName(name) {
    if (name == null) return "";
    const raw = String(name);
    const s = window.MobilePatch ? window.MobilePatch.normalize(raw) : raw;
    return s.toLowerCase().trim();
  }

  function addDays(d, n) {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + n);
    return x;
  }

  function buildWeekData(FULL_DATA, hotel, monday) {
    const schedule = (FULL_DATA && FULL_DATA.schedule) ? FULL_DATA.schedule : [];

    // Lunes de la semana (clave base, en UTC)
    const mondayUTC = new Date(Date.UTC(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate()
    ));

    // Claves de fecha de la semana seleccionada
    const weekDates = [];
    const weekDateSet = new Set();
    for (let i = 0; i < 7; i++) {
      const d = addDays(mondayUTC, i);
      const key = normalizeDateKey(d.toISOString().slice(0, 10)); // YYYY-MM-DD
      weekDates.push(key);
      weekDateSet.add(key);
    }

    const hotelNormTarget = normalizeHotelName(hotel);

    const turnosByEmpleado = {};
    const ordenSet = new Set();
    const ordenSemana = [];

    // Recorremos todos los bloques de ese hotel
    for (const bucket of schedule) {
      const hNorm = normalizeHotelName(bucket.hotel);
      if (!hNorm || hNorm !== hotelNormTarget) continue;

      // Orden específico de esa semana (igual que index)
      const semanaKey = normalizeDateKey(bucket.semana_lunes);
      if (semanaKey && semanaKey === weekDates[0]) {
        (bucket.orden_empleados || []).forEach(e => {
          if (!ordenSemana.includes(e)) ordenSemana.push(e);
        });
      }

      // Orden general (por si falta semana_lunes o no coincide)
      (bucket.orden_empleados || []).forEach(e => ordenSet.add(e));

      // Turnos de la semana seleccionada
      (bucket.turnos || []).forEach(t => {
        const emp = t.empleado;
        const fechaKey = normalizeDateKey(t.fecha);
        if (!emp || !fechaKey) return;
        if (!weekDateSet.has(fechaKey)) return; // fuera de la semana

        if (!turnosByEmpleado[emp]) turnosByEmpleado[emp] = {};
        turnosByEmpleado[emp][fechaKey] = { turno: t.turno };
      });
    }

    const orden = (ordenSemana.length ? ordenSemana : Array.from(ordenSet));

    const empleados = orden.filter(emp => {
      const m = turnosByEmpleado[emp] || {};
      return weekDates.some(d => m[d]);
    });

    return {
      monday: mondayUTC,
      empleados: empleados.length ? empleados : orden,
      turnosByEmpleado
    };
  }

  return { buildWeekData };
})();
