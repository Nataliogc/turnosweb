/* plantilla_mobile_adapter.js
   Adaptador para versión móvil:
   - Usa window.FULL_DATA (mismo formato que index/live)
   - Para cada hotel + lunes de semana construye la misma parrilla lógica que index
   - Respeta orden_empleados y mueve al final los ausentes toda la semana
   - Añade al sustituto en la posición del ausente
*/
window.MobileAdapter = (function () {
  const pad = n => String(n).padStart(2, "0");

  function normalizeDateKey(value) {
    if (!value) return null;

    if (typeof value === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (m) {
        return `${m[3]}-${m[2]}-${m[1]}`;
      }
    }

    if (value instanceof Date) {
      return [
        value.getFullYear(),
        pad(value.getMonth() + 1),
        pad(value.getDate())
      ].join("-");
    }

    return null;
  }

  function normalizeHotelName(name) {
    if (name == null) return "";
    const raw = String(name);
    const s = window.MobilePatch ? window.MobilePatch.normalize(raw) : raw;
    return s.toLowerCase().trim();
  }

  function mondayUTC(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay();
    const diff = (day === 0 ? -6 : 1 - day);
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
  }

  function addDays(d, n) {
    const x = new Date(d.getTime());
    x.setUTCDate(x.getUTCDate() + n);
    return x;
  }

  function isoFromUTCDate(d) {
    return [
      d.getUTCFullYear(),
      pad(d.getUTCMonth() + 1),
      pad(d.getUTCDate())
    ].join("-");
  }

  function buildWeekGrid(hotelGroup, weekDays) {
    const grid = {};
    const meta = {};
    const absenceCount = {};
    const subCandidate = {};

    const allEmployees = new Set(hotelGroup.orden_empleados || []);

    (hotelGroup.turnos || []).forEach(t => {
      const turno = t.turno;
      if (turno && typeof turno === "object" && turno.Sustituto) {
        allEmployees.add(turno.Sustituto);
      }
    });

    allEmployees.forEach(emp => {
      grid[emp] = {};
      meta[emp] = {};
      weekDays.forEach(d => {
        grid[emp][d] = "";
        meta[emp][d] = null;
      });
    });

    (hotelGroup.turnos || []).forEach(t => {
      const emp = t.empleado;
      const fechaKey = normalizeDateKey(t.fecha);
      if (!emp || !fechaKey) return;
      if (!grid[emp] || !(fechaKey in grid[emp])) return;
      grid[emp][fechaKey] = t.turno;
    });

    for (const emp of (hotelGroup.orden_empleados || [])) {
      for (const day of weekDays) {
        const raw = grid[emp] && grid[emp][day];
        if (raw && typeof raw === "object") {
          const exact =
            (raw.TipoInterpretado ??
             raw.TipoAusencia ??
             raw["Tipo Ausencia"] ??
             "").toString().trim();
          const etiqueta = exact || "Ausencia";

          grid[emp][day] = etiqueta;

          const m = meta[emp][day] || {};
          m.isAbsence = true;
          m.absenceLabel = etiqueta;
          meta[emp][day] = m;

          absenceCount[emp] = (absenceCount[emp] || 0) + 1;

          const sust = raw.Sustituto;
          if (sust) {
            if (!grid[sust]) {
              grid[sust] = {};
              meta[sust] = {};
              weekDays.forEach(d => {
                grid[sust][d] = "";
                meta[sust][d] = null;
              });
            }
            const turnoOrig =
              raw.TurnoOriginal ||
              raw["TurnoOriginal"] ||
              raw["Turno original"] ||
              raw.Turno ||
              "";

            grid[sust][day] = turnoOrig;
            meta[sust][day] = { isSub: true, for: emp, turno: turnoOrig };
            if (!subCandidate[emp]) subCandidate[emp] = sust;
          }
        }
      }
    }

    return { grid, meta, absenceCount, subCandidate };
  }

  function buildWeekData(FULL_DATA, hotel, monday) {
    const schedule = (FULL_DATA && FULL_DATA.schedule) ? FULL_DATA.schedule : [];

    const mondayUTCDate = mondayUTC(monday);
    const mondayISO = isoFromUTCDate(mondayUTCDate);

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      weekDays.push(isoFromUTCDate(addDays(mondayUTCDate, i)));
    }

    const hotelNormTarget = normalizeHotelName(hotel);

    const groups = schedule.filter(bucket =>
      normalizeHotelName(bucket.hotel) === hotelNormTarget &&
      normalizeDateKey(bucket.semana_lunes) === mondayISO
    );

    if (!groups.length) {
      return {
        monday: mondayUTCDate,
        empleados: [],
        turnosByEmpleado: {}
      };
    }

    const hotelGroup = {
      hotel: groups[0].hotel,
      semana_lunes: mondayISO,
      orden_empleados: [],
      turnos: []
    };

    const seenEmp = new Set();
    groups.forEach(g => {
      (g.orden_empleados || []).forEach(e => {
        if (!seenEmp.has(e)) {
          seenEmp.add(e);
          hotelGroup.orden_empleados.push(e);
        }
      });
      (g.turnos || []).forEach(t => hotelGroup.turnos.push(t));
    });

    const { grid, meta, absenceCount, subCandidate } =
      buildWeekGrid(hotelGroup, weekDays);

    const weekAbsent = new Set(
      Object.keys(absenceCount).filter(emp => absenceCount[emp] === weekDays.length)
    );

    let display = (hotelGroup.orden_empleados || [])
      .map(e => weekAbsent.has(e) ? (subCandidate[e] || e) : e)
      .filter(Boolean);

    display = [...new Set(display)];
    display = display.filter(e => !weekAbsent.has(e));
    display.push(...Array.from(weekAbsent));

    display = display.filter(emp =>
      weekDays.some(day => grid[emp] && grid[emp][day])
    );

    const turnosByEmpleado = {};
    display.forEach(emp => {
      weekDays.forEach(day => {
        const val = grid[emp] && grid[emp][day];
        if (val) {
          if (!turnosByEmpleado[emp]) turnosByEmpleado[emp] = {};
          turnosByEmpleado[emp][day] = { turno: val };
        }
      });
    });

    return {
      monday: mondayUTCDate,
      empleados: display,
      turnosByEmpleado
    };
  }

  return { buildWeekData };
})();
