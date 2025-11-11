/* plantilla_mobile_adapter.js
   Construye la semana visible a partir de window.FULL_DATA (mismo formato que index/live).
*/
window.MobileAdapter = (function(){
  const pad = n => String(n).padStart(2,'0');
  function toISO(d){
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    return `${x.getUTCFullYear()}-${pad(x.getUTCMonth()+1)}-${pad(x.getUTCDate())}`;
  }
  function addDays(d, n){ const x = new Date(d); x.setUTCDate(x.getUTCDate()+n); return x; }

  function buildWeekData(FULL_DATA, hotel, monday){
    const schedule = (FULL_DATA && FULL_DATA.schedule) ? FULL_DATA.schedule : [];
    // Seleccionar semana y hotel exactos
    const isoMonday = toISO(monday);
    const bucket = schedule.find(s => s.hotel === hotel && s.semana_lunes === isoMonday);
    const result = { monday: monday, empleados: [], turnosByEmpleado: {} };

    if(!bucket){
      // Si no hay coincidencia exacta, intenta el primer bloque de ese hotel
      const alt = schedule.find(s => s.hotel === hotel);
      if(!alt){ return result; }
      monday = new Date(alt.semana_lunes);
      result.monday = monday;
      // continuar con alt
      return buildWeekData(FULL_DATA, hotel, monday);
    }

    const orden = (bucket.orden_empleados || []).slice();
    const turnos = bucket.turnos || [];

    // Indexar turnos por empleado+fecha
    const map = {};
    turnos.forEach(t => {
      if(!map[t.empleado]) map[t.empleado] = {};
      map[t.empleado][t.fecha] = { turno: t.turno };
    });

    // Filtrar empleados sin ningún turno en la semana (7 días)
    const weekDates = Array.from({length:7}, (_,i)=> toISO(addDays(new Date(bucket.semana_lunes), i)));
    const empleados = orden.filter(emp => {
      const m = map[emp] || {};
      return weekDates.some(d => m[d]);
    });

    // Si todos estuvieran vacíos (caso extremo), devolver orden original para no dejar la tabla vacía
    result.empleados = empleados.length ? empleados : orden;
    result.turnosByEmpleado = map;
    return result;
  }

  return { buildWeekData };
})();
