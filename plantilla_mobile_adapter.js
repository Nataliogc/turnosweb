/* plantilla_mobile_adapter.js
   Construye la semana visible a partir de window.FULL_DATA (mismo formato que index/live).
   Versión simplificada para móvil:
   - Usa exactamente el lunes seleccionado.
   - Si no hay datos para ese lunes/hotel, devuelve tabla vacía (sin “saltar” a otra semana).
*/
window.MobileAdapter = (function(){
  const pad = n => String(n).padStart(2,'0');

  function toISO(d){
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    return `${x.getUTCFullYear()}-${pad(x.getUTCMonth()+1)}-${pad(x.getUTCDate())}`;
  }

  function addDays(d, n){
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate()+n);
    return x;
  }

  function buildWeekData(FULL_DATA, hotel, monday){
    const schedule = (FULL_DATA && FULL_DATA.schedule) ? FULL_DATA.schedule : [];
    const isoMonday = toISO(monday);

    // Buscar bloque exacto para ese hotel y lunes
    const bucket = schedule.find(s => s.hotel === hotel && s.semana_lunes === isoMonday);

    // Resultado base
    const result = {
      monday: monday,          // lunes seleccionado
      empleados: [],
      turnosByEmpleado: {}
    };

    // Si no hay datos para esa semana/hotel → tabla vacía
    if(!bucket){
      return result;
    }

    const orden  = (bucket.orden_empleados || []).slice();
    const turnos = bucket.turnos || [];

    // Indexar turnos por empleado+fecha
    const map = {};
    turnos.forEach(t => {
      if(!map[t.empleado]) map[t.empleado] = {};
      map[t.empleado][t.fecha] = { turno: t.turno };
    });

    // Fechas reales de esa semana según el propio bucket
    const baseMonday = new Date(bucket.semana_lunes);
    result.monday = baseMonday;

    const weekDates = Array.from(
      {length:7},
      (_,i)=> toISO(addDays(baseMonday, i))
    );

    // Empleados con al menos un turno en la semana
    const empleados = orden.filter(emp => {
      const m = map[emp] || {};
      return weekDates.some(d => m[d]);
    });

    result.empleados       = empleados.length ? empleados : orden;
    result.turnosByEmpleado = map;
    return result;
  }

  return { buildWeekData };
})();
