(function() {
  const $ = (s, r = document) => r.querySelector(s);
  const controls = () => document.querySelector('.controls-container');
  let hideTimer;

  // Mostrar controles
  function showControls() {
    const c = controls();
    if (c) {
      c.style.display = 'flex';
      c.style.opacity = '1';
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hideControls, 8000); // Ocultar tras 8 s
    }
  }

  // Ocultar controles (pantalla limpia)
  function hideControls() {
    const c = controls();
    if (c) {
      c.style.opacity = '0';
      setTimeout(() => {
        c.style.display = 'none';
      }, 500);
    }
  }

  // Inicializar cuando el DOM está listo
  function init() {
    const c = controls();
    if (!c) return;
    c.style.transition = 'opacity 0.5s ease';
    showControls();

    // Mostrar controles al tocar la cabecera
    const header = $('header');
    if (header) header.addEventListener('click', showControls);

    // También si cambia algo (fecha, filtros, etc.)
    c.addEventListener('change', showControls);
    c.addEventListener('click', showControls);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
