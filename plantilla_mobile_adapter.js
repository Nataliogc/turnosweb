/* plantilla_mobile_adapter.js
   Adaptador para versión móvil:
   - Usa window.FULL_DATA (mismo formato que index/live)
   - Selecciona el grupo por hotel + semana_lunes
   - Respeta orden_empleados
   - Aplica la misma lógica básica de ausencias y sustituciones:
     · Ausencias: usa TipoInterpretado / TipoAusencia / "Tipo Ausencia"
     · Si un empleado está ausente toda la semana y tiene sustituto,
       el sustituto ocupa su posición y el titular baja al final.
*/
window.MobileAdapter = (function () {
  const pad = n => String(n).padStart(2, "0");

  function toISODateUTC(d) {
    return (
      d.getUTCFullYear() +
      "-" +
      pad(d.getUTCMonth() + 1) +
      "-" +
      pad(d.getUTCDate())
    );
  }

  function addDaysUTC(d, n) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    x.setUTCDate(x.getUTCDate() + n);
    return x;
  }

  function normalizeDateKey(value) {
    if (!value) return null;
    if (value instanceof Date) return toISODateUTC(value);

    const s = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;

    const d = new Date(s);
    if (!isNaN(d.getTime())) return toISODateUTC(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())));

    return null;
  }

  function normalizeHotelName(h) {
    if (!h) return "";
    const s = String(h).toLowerCase().trim();
    return s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ");
  }

  function buildWeekData(FULL_DATA, hotel, monday) {
    const data = FULL_DATA || {};
    const schedule = Array.isArray(data.schedule) ? data.schedule : [];

    // Monday como fecha base en UTC (igual que mobile.app.js)
    const mondayUTC = new Date(
      Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate())
    );
    const mondayKey = toISODateUTC(mondayUTC);

    // Fechas de la semana visible
    const weekDates = [];
    const weekDateSet = new Set();
    for (let i = 0; i < 7; i++) {
      const d = addDaysUTC(mondayUTC, i);
      const key = toISODateUTC(d);
      weekDates.push(key);
      weekDateSet.add(key);
    }

    const hotelNorm = normalizeHotelName(hotel);

    // Buscar el/los grupos de esa semana y ese hotel
    const groups = schedule.filter(g => {
      if (!g) return false;
      if (g.semana_lunes !== mondayKey) return false;
      if (!hotelNorm) return true;
      return normalizeHotelName(g.hotel) === hotelNorm;
    });

    if (!groups.length) {
      return { monday: mondayUTC, empleados: [], turnosByEmpleado: {} };
    }

    // Unificamos orden_empleados y turnos por si hubiera más de un bloque
    const ordenBase = [];
    const ordenSet = new Set();
    const turnosRaw = [];

    groups.forEach(g => {
      (g.orden_empleados || []).forEach(emp => {
        if (!ordenSet.has(emp)) {
          ordenSet.add(emp);
          ordenBase.push(emp);
        }
      });
      (g.turnos || []).forEach(t => {
        turnosRaw.push(t);
      });
    });

    // Si por lo que sea no hay orden ni turnos, devolvemos vacío
    if (!ordenBase.length && !turnosRaw.length) {
      return { monday: mondayUTC, empleados: [], turnosByEmpleado: {} };
    }

    // Construimos conjunto de empleados (incluyendo posibles sustitutos)
    const allEmployees = new Set(ordenBase);
    turnosRaw.forEach(t => {
      const v = t.turno;
      if (v && typeof v === "object" && (v.Sustituto || v.sustituto)) {
        allEmployees.add(v.Sustituto || v.sustituto);
      }
    });

    const grid = {};
    const meta = {};
    const absenceCount = {};
    const subCandidate = {};

    allEmployees.forEach(emp => {
      grid[emp] = {};
      meta[emp] = {};
      weekDates.forEach(d => {
        grid[emp][d] = null;
        meta[emp][d] = null;
      });
    });

    // Carga base: lo que viene de CSV
    turnosRaw.forEach(t => {
      const emp = t.empleado;
      const fechaKey = normalizeDateKey(t.fecha);
      if (!emp || !fechaKey || !weekDateSet.has(fechaKey)) return;

      if (!grid[emp]) {
        grid[emp] = {};
        meta[emp] = {};
        weekDates.forEach(d => {
          grid[emp][d] = null;
          meta[emp][d] = null;
        });
      }
      grid[emp][fechaKey] = t.turno;
    });

    // Ausencias + sustituciones (mismo criterio que index)
    ordenBase.forEach(emp => {
      weekDates.forEach(day => {
        const raw = grid[emp] && grid[emp][day];
        if (!raw || typeof raw !== "object") return;

        const exact = (
          raw.TipoInterpretado ??
          raw.TipoAusencia ??
          raw["Tipo Ausencia"] ??
          ""
        ).toString().trim();

        if (exact) {
          // dejamos el objeto para que getLabel lo pueda leer, pero marcamos el texto
          const cloned = Object.assign({}, raw, { TipoInterpretado: exact });
          grid[emp][day] = cloned;
          meta[emp][day] = Object.assign({}, meta[emp][day], {
            isAbsence: true,
            absenceLabel: exact
          });
          absenceCount[emp] = (absenceCount[emp] || 0) + 1;
        }

        const sub = raw.Sustituto || raw.sustituto;
        if (sub) {
          subCandidate[emp] = sub;

          if (!grid[sub]) {
            grid[sub] = {};
            meta[sub] = {};
            weekDates.forEach(d => {
              grid[sub][d] = null;
              meta[sub][d] = null;
            });
          }

          const originalShift =
            raw.TurnoOriginal ||
            raw.turno ||
            raw.t ||
            "";

          if (originalShift) {
            // al sustituto le ponemos directamente el turno original (string)
            grid[sub][day] = { TurnoOriginal: originalShift };
            meta[sub][day] = Object.assign({}, meta[sub][day], {
              isSubstitute: true,
              for: emp
            });
          }
        }
      });
    });

    // Empleados ausentes toda la semana
    const weekAbsent = new Set(
      ordenBase.filter(emp => absenceCount[emp] === weekDates.length)
    );

    // Orden visual: como index
    let display = ordenBase
      .map(e => (weekAbsent.has(e) ? (subCandidate[e] || e) : e))
      .filter(Boolean);

    // Quitar duplicados manteniendo orden
    display = Array.from(new Set(display));

    // Los ausentes toda la semana (sin sustituto real) al final
    display = display.filter(e => !weekAbsent.has(e));
    display.push(...Array.from(weekAbsent));

    // Filtrar empleados sin nada en la semana
    display = display.filter(emp => {
      const g = grid[emp] || {};
      return weekDates.some(d => {
        const v = g[d];
        return v !== null && v !== undefined && v !== "";
      });
    });

    if (!display.length) {
      return { monday: mondayUTC, empleados: [], turnosByEmpleado: {} };
    }

    // Mapa empleado → día → { turno, meta }
    const turnosByEmpleado = {};
    display.forEach(emp => {
      const g = grid[emp] || {};
      weekDates.forEach(d => {
        const v = g[d];
        if (v === null || v === undefined || v === "") return;
        if (!turnosByEmpleado[emp]) turnosByEmpleado[emp] = {};
        turnosByEmpleado[emp][d] = {
          turno: v,
          meta: meta[emp][d] || null
        };
      });
    });

    return {
      monday: mondayUTC,
      empleados: display,
      turnosByEmpleado
    };
  }

  return { buildWeekData };
})();
