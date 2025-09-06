# Turnos Web – Paquete rápido

## Archivos incluidos
- **index.html** — UI con __DATA_PLACEHOLDER__ y autocarga segura.
- **plantilla_adapter_semana.js** — Adaptador que pinta semanas, filtros, ICS, etc.
- **generar_index.py** — Incrusta los datos del `turnos_final.html`/`live.html` dentro de `index.html`.
- **run_todo.bat** — Ejecuta el flujo completo: genera CSV (si existe `2generar_turnos CSV.py` o `2generar_turnos_CSV.py`), embebe datos y abre la web.
- **Logo.png** — Logo (opcional).

## Uso
1. Copia todo el paquete en tu carpeta de proyecto.
2. Asegúrate de que tu script CSV se llame **`2generar_turnos CSV.py`** o **`2generar_turnos_CSV.py`** y tenga la ruta correcta al Excel (`EXCEL_PATH`).
3. Doble click a **run_todo.bat**.
4. Si algo falla, mira `logs\1_csv.log` y `logs\2_index.log`.

## Notas
- Si no hay datos embebidos, `index.html` intenta **autocargar** `turnos_final.html` o `live.html` leyendo `window.DATA_GROUPS` o `window.DATA`.
- Si prefieres forzar embebido siempre, mantén `__DATA_PLACEHOLDER__` y asegúrate que `generar_index.py` encuentre datos.
