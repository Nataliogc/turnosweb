/* mobile.patch.js — sólo arregla mojibake leve, no toca HTML de celdas */
(function () {
  'use strict';
  function fix(s){ return String(s||'')
    .replace(/Ã¡/g,'á').replace(/Ã©/g,'é').replace(/Ã­/g,'í')
    .replace(/Ã³/g,'ó').replace(/Ãº/g,'ú').replace(/Ã±/g,'ñ')
    .replace(/Ã/g,'Á').replace(/Ã‰/g,'É').replace(/Ã/g,'Í')
    .replace(/Ã“/g,'Ó').replace(/Ãš/g,'Ú').replace(/Ã‘/g,'Ñ'); }
  document.addEventListener('mobile:rendered', ()=>{
    document.querySelectorAll('.grid td, .grid th, .weekTitle').forEach(el=>{ el.textContent = fix(el.textContent); });
  });
})();