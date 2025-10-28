// RELLENO SEGURO DE SELECTS (no leer .value si el select no existe)
function populateFilters() {
  try {
    const selHotel = document.getElementById('hotelSelect');
    const selEmp   = document.getElementById('employeeFilter');

    // Si los selects aún no existen (APP: drawer), salimos sin romper.
    if (!selHotel || !selEmp) return;

    // Hoteles desde FULL_DATA (o fallback)
    const D = window.FULL_DATA || {};
    const S = D.schedule || D.data || [];
    const hotels = [...new Set(
      S.map(x => x.hotel || x.Hotel || x.establecimiento || x?.meta?.hotel).filter(Boolean)
    )];
    const listHotels = hotels.length ? hotels : ["Sercotel Guadiana", "Cumbria Spa&Hotel"];

    selHotel.innerHTML = '<option value="">— Hotel —</option>' + listHotels.map(h =>
      `<option value="${h}">${h}</option>`
    ).join('');

    // Empleados iniciales (por hotel si ya hay valor)
    const currentHotel = selHotel.value || '';
    refreshEmployeeOptions(currentHotel);
  } catch (e) {
    console.warn('[adapter] populateFilters() protegido:', e);
  }
}
