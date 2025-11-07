/* normalize_data.js — shim seguro para normalizar turnos y no romper dependencias */
(function () {
  const MAP = [
    [/MaÃ±ana/g, 'Mañana'],
    [/Tarde/g, 'Tarde'],
    [/Noche\s*(?:ð[\u0000-\uFFFF]*|🌙)?/g, 'Noche 🌙'],
    [/Descanso(?:[^\w]|”|„)*/g, 'Descanso'],
    [/Vacaciones(?:[^\w]|¤|–|ï¸|–)*/g, 'Vacaciones 🏖️'],
    [/Baja(?:[^\w]|¤|’|ï¸)*/g, 'Baja 🤒'],
    [/Permiso(?:[^\w]|ðŸ—“ï¸)*/g, 'Permiso 🗓️'],
    [/Formaci[oó]n(?:[^\w]|ðŸ“)?/g, 'Formación 🎓'],
    [/\bC\/T\b|Cambio(?:\s+de)?\s+turno|\u2194/g, 'C/T 🔄'],
    [/[\uFFFD\u0092\u00AD]/g, ''] // caracteres raros
  ];

  function norm(s) {
    let out = (s ?? '') + '';
    MAP.forEach(([re, rep]) => (out = out.replace(re, rep)));
    if (/^Noche\s*$/.test(out)) out = 'Noche 🌙';
    return out.trim();
  }

  // API esperada por algunas plantillas
  window.normalizeTurno = window.normalizeTurno || norm;

  // Si FULL_DATA tiene filas, normaliza en caliente (no obligatorio)
  const S = window.FULL_DATA;
  const rows = Array.isArray(S?.data) ? S.data
            : Array.isArray(S?.rows) ? S.rows
            : Array.isArray(S) ? S : null;

  if (rows) {
    rows.forEach(r => {
      const k = ['turno','Turno','TipoAusencia','ausencia','motivo'].find(x => r && x in r);
      if (k) r[k] = norm(r[k]);
    });
  }
})();
