/* mobile.patch.js — Parche de textos para versión móvil
   - Corrige mojibake (acentos rotos tipo "ValentÃ­n")
   - Arregla restos de emojis mal codificados (Vacaciones, Noche, C/T…)
   - No toca index/live: sólo actúa tras el render móvil
*/

(function () {
  'use strict';

  // ---- Normalizador de texto (acentos + emojis + etiquetas de turno) ----
  function fixText(s) {
    s = String(s == null ? '' : s);

    // Acentos comunes rotos por mojibake
    s = s
      .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í')
      .replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú').replace(/Ã±/g, 'ñ')
      .replace(/Ã/g, 'Á').replace(/Ã‰/g, 'É').replace(/Ã/g, 'Í')
      .replace(/Ã“/g, 'Ó').replace(/Ãš/g, 'Ú').replace(/Ã‘/g, 'Ñ');

    // Emojis/artefactos frecuentes en datos históricos
    s = s
      .replace(/ðŸ”„/g, '🔄')   // artefacto que a veces sale en "Tarde ðŸ”„"
      .replace(/ðŸ–ï¸/g, '🏖️') // Vacaciones
      .replace(/ðŸŒ™/g, '🌙')   // luna
      .replace(/ï¸/g, '')      // VS-16 sobrante
      ;

    // Normalizaciones de valores de turno (robustas)
    s = s
      .replace(/\bNoche\b[\s\S]*$/g, 'Noche 🌙')
      .replace(/Descanso[\s\S]*$/g, 'Descanso')
      .replace(/Vacaciones[\s\S]*$/g, 'Vacaciones 🏖️')
      .replace(/\bC\/T\b|Cambio(?:\s+de)?\s+turno|\u2194|\u21C4|↔/g, 'C/T 🔄');

    return s.trim();
  }

  // ---- Aplica la corrección al DOM del cuadrante móvil ----
  function applyFixes() {
    // Celdas de cuadrante y cabeceras
    document.querySelectorAll('.grid td, .grid th, .weekTitle, .weekRange')
      .forEach(el => { el.textContent = fixText(el.textContent); });

    // Primera columna (nombres)
    document.querySelectorAll('.grid tbody tr td:first-child')
      .forEach(el => { el.textContent = fixText(el.textContent); });
  }

  // Hook oficial del móvil (lo dispara mobile.app.js / plantilla_mobile_adapter.js)
  document.addEventListener('mobile:rendered', applyFixes);

  // Por si el primer render cae antes del hook (apertura file://)
  document.addEventListener('DOMContentLoaded', () => setTimeout(applyFixes, 50));
})();
