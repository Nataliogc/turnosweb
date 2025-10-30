/* mobile.patch.js
   - Registra el Service Worker solo en https/http/localhost (evita error en file://)
   - Pequeños parches de accesibilidad y scroll.
*/
(() => {
  // SW seguro
  const isSecureOrigin = location.protocol === 'https:' ||
                         location.hostname === 'localhost' ||
                         location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && isSecureOrigin) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(console.warn);
    });
  }

  // Foco accesible al cambiar de semana
  const weeks = document.getElementById('weeks');
  const meta  = document.getElementById('meta');
  ['btnPrev','btnNext','btnToday'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', () => {
      setTimeout(() => { meta?.focus?.(); meta?.scrollIntoView?.({behavior:'smooth',block:'start'}); }, 0);
    });
  });
})();
