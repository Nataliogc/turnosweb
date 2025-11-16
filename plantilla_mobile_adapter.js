/* plantilla_mobile_adapter.js
   Adaptador para versión móvil:
   - Usa window.FULL_DATA (mismo formato que index/live)
   - Respeta orden_empleados de cada hotel
   - Aplica misma lógica de ausencias y sustituciones que la vista semanal:
     · Ausencias: muestra el texto de TipoInterpretado / TipoAusencia
     · Sustituciones: el sustituto ocupa la posición del titular si está ausente
       toda la semana y su turno se marca con ↔ (via getFlag en mobile.app.js)
     · Empleados ausentes toda la semana bajan al final
*/
window.MobileAdapter = (function () {
  const pad = n => String(n).padStart(2, "0");

  // Normaliza fecha a clave "YYYY-MM-DD"
  function normalizeDateKey(value) {
    if (!value) return null;
    if (value instanceof Date) {
      const y = value.getUTCFullYear();
      const m = pad(value.getUTCMonth() + 1);
      const d = pad(value.getUTCDate());
      return `${y}-${m}-${d}`;
    }
    const s = String(value).trim();
    // ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // dd/mm/aaaa
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m) {
      return `${m[3]}-${m[2]}-${m[1]}`;
    }
    // fallback genérico
    try {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        const y = d.getUTCFullYear();
        const mm = pad(d.getUTCMonth() + 1);
        const dd = pad(d.getUTCDate());
        return `${y}-${mm}-${dd}`;
      }
    } catch (e) {}
    return null;
  }

  function normalizeHotelName(h) {
    if (!h) return "";
    const s = String(h).toLowerCase().trim();
    if (!s) return "";
    return s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ");
  }

  function addDaysUTC(d, n) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    x.setUTCDate(x.getUTCDate() + n);
    return x;
  }

  function buildWeekData(FULL_DATA, hotel, monday) {
    const rawSchedule = (FULL_DATA && FULL_DATA.schedule) ? FULL_DATA.schedule : [];

    // Lunes de la semana (en UTC)
    const mondayUTC = new Date(Date.UTC(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate()
    ));

    // Claves de fecha de la semana seleccionada
    const weekDates = [];
    const weekDateSet = new Set();
    for (let i = 0; i < 7; i++) {
      const d = addDaysUTC(mondayUTC, i);
      const key = normalizeDateKey(d);
      if (!key) continue;
      weekDates.push(key);
      weekDateSet.add(key);
    }

    const hotelNormTarget = normalizeHotelName(hotel);

    // Agrupamos datos del hotel (orden_empleados + turnos de la semana)
    const ordenBase = [];
    const ordenSet  = new Set();
    const turnosRaw = [];

    for (const bucket of rawSchedule) {
      const hNorm = normalizeHotelName(bucket.hotel);
      if (!hNorm || hNorm !== hotelNormTarget) continue;

      (bucket.orden_empleados || []).forEach(e => {
        if (!ordenSet.has(e)) {
          ordenSet.add(e);
          ordenBase.push(e);
        }
      });

      (bucket.turnos || []).forEach(t => {
        const fechaKey = normalizeDateKey(t.fecha);
        if (!fechaKey || !weekDateSet.has(fechaKey)) return;
        turnosRaw.push({
          empleado: t.empleado,
          fecha: fechaKey,
          turno: t.turno
        });
      });
    }

    if (!ordenBase.length && !turnosRaw.length) {
      return { monday: mondayUTC, empleados: [], turnosByEmpleado: {} };
    }

    // Conjunto completo de empleados (incluye posibles sustitutos)
    const allEmployees = new Set(ordenBase);
    turnosRaw.forEach(t => {
      const v = t.turno;
      if (v && typeof v === "object" && (v.Sustituto || v.sustituto)) {
        allEmployees.add(v.Sustituto || v.sustituto);
      }
    });

    // Estructuras base
    const grid = {};
    const meta = {};
    const absenceCount = {};
    const subCandidate  = {};

    allEmployees.forEach(emp => {
      grid[emp] = {};
      meta[emp] = {};
      weekDates.forEach(d => {
        grid[emp][d] = null;
        meta[emp][d] = null;
      });
    });

    // Carga base (tal cual vienen del data.js / FULL_DATA)
    turnosRaw.forEach(t => {
      if (!grid[t.empleado]) return;
      grid[t.empleado][t.fecha] = t.turno;
    });

    // Procesar ausencias + sustituciones siguiendo la lógica del index
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
          // Marca ausencia en el titular
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
            grid[sub][day] = {
              TurnoOriginal: originalShift,
              esSustituto: true
            };
            meta[sub][day] = Object.assign({}, meta[sub][day], {
              isSubstitute: true,
              for: emp
            });
          }
        }
      });
    });

    // Empleados ausentes TODA la semana
    const weekAbsent = new Set(
      ordenBase.filter(emp => absenceCount[emp] === weekDates.length)
    );

    // Orden visual:
    // - Basado en orden_empleados
    // - Si el titular está ausente toda la semana y tiene Sustituto, mostramos al sustituto en su lugar
    // - Los ausentes toda la semana bajan al final
    let display = ordenBase
      .map(e => (weekAbsent.has(e) ? (subCandidate[e] || e) : e))
      .filter(Boolean);

    // Eliminar duplicados conservando orden
    display = Array.from(new Set(display));

    // Mover ausentes al final (si no han sido sustituidos)
    display = display.filter(e => !weekAbsent.has(e));
    display.push(...Array.from(weekAbsent));

    // Filtrar empleados sin ningún dato en la semana visible
    display = display.filter(emp => {
      const g = grid[emp] || {};
      return weekDates.some(d => {
        const v = g[d];
        return v !== null && v !== undefined && v !== "";
      });
    });

    // Si no queda nadie con turnos, devolvemos estructura vacía
    if (!display.length) {
      return { monday: mondayUTC, empleados: [], turnosByEmpleado: {} };
    }

    // Mapa final empleado → día → item { turno, meta }
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
