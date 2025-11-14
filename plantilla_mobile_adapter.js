/* plantilla_mobile_adapter.js
   Adaptador para versión móvil:
   - Usa window.FULL_DATA (mismo formato que index/live)
   - Selecciona semana por lunes y hotel
   - Soporta formatos de fecha flexibles en semana_lunes
   - Si no hay datos para esa semana/hotel → tabla vacía
*/
window.MobileAdapter = (function () {
  const pad = n => String(n).padStart(2, "0");

  function toISOFromDate(d) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
  }

  // Admite '2025-11-10', '2025-11-10T00:00:00Z', '10/11/25', etc.
  function normalizeWeekMonday(value) {
    if (!value) return null;

    // 1) Si ya parece ISO (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }

    // 2) Intentar parseo directo con Date
    let d = new Date(value);
    if (!isNaN(d.getTime())) {
      return toISOFromDate(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));
    }

    // 3) Formato dd/mm/aa o dd/mm/aaaa
    const m = String(value).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      let [_, dd, mm, yy] = m;
      dd = parseInt(dd, 10);
      mm = parseInt(mm, 10) - 1;
      let year = parseInt(yy, 10);
      if (year < 100) year += 2000;
      d = new Date(Date.UTC(year, mm, dd));
      if (!isNaN(d.getTime())) return toISOFromDate(d);
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

    const isoTarget = toISOFromDate(
      new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()))
    );

    const hotelNormTarget = normalizeHotelName(hotel);

    // Buscar bucket por hotel + lunes (tolerante a formatos)
    let bucket = null;
    for (const s of schedule) {
      const hNorm = normalizeHotelName(s.hotel);
      if (!hNorm || hNorm !== hotelNormTarget) continue;

      const isoBucket = normalizeWeekMonday(s.semana_lunes);
      if (!isoBucket) continue;

      if (isoBucket === isoTarget) {
        bucket = s;
        break;
      }
    }

    const result = {
      monday,
      empleados: [],
      turnosByEmpleado: {}
    };

    if (!bucket) {
      // No hay datos para esa semana/hotel → tabla vacía
      return result;
    }

    const orden = (bucket.orden_empleados || []).slice();
    const turnos = bucket.turnos || [];

    // Indexar turnos
    const map = {};
    turnos.forEach(t => {
      const emp = t.empleado;
      const fecha = normalizeWeekMonday(t.fecha) || t.fecha;
      if (!emp || !fecha) return;
      if (!map[emp]) map[emp] = {};
      map[emp][fecha] = { turno: t.turno };
    });

    // Fechas reales de esa semana según bucket.semana_lunes
    const baseMondayISO = normalizeWeekMonday(bucket.semana_lunes) || isoTarget;
    const baseMondayDate = new Date(baseMondayISO + "T00:00:00Z");

    result.monday = baseMondayDate;

    const weekDates = Array.from(
      { length: 7 },
      (_, i) => {
        const d = addDays(baseMondayDate, i);
        return toISOFromDate(d);
      }
    );

    // Empleados con al menos un turno en la semana
    const empleados = orden.filter(emp => {
      const m = map[emp] || {};
      return weekDates.some(d => m[d]);
    });

    result.empleados = empleados.length ? empleados : orden;
    result.turnosByEmpleado = map;

    return result;
  }

  return { buildWeekData };
})();
