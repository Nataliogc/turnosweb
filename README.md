# Turnos Web – Front (estático)

Este paquete contiene una capa *front-end* para visualizar cuadrantes semanales.

## Archivos

- `index.html`: página principal. Si tu generador inyecta `window.DATA = { rows:[...] }` dentro del propio HTML, se utiliza directamente. Si no existe, intentará cargar `DATA_preview.json` únicamente a efectos de prueba.
- `plantilla_adapter_semana.js`: lógica de pintado semanal (lunes→domingo), etiquetas de ausencia, mapeo de turnos a **Mañana/Tarde/Noche/Descanso**, empleados ausentes toda la semana al final, filtros y rango *Desde/Hasta*.
- `styles.css`: estilos.
- `run_front.bat`: servidor local en `http://localhost:8000` (evita el problema de *Cargando…* por `file:///`).
- `DATA_preview.json`: ejemplo vacío para que abra sin datos.

## Uso rápido

1. Copia estos archivos en el mismo directorio donde generas `index.html` con tus datos (o usa este `index.html` si lo prefieres).
2. Ejecuta `run_front.bat` para abrir `http://localhost:8000/index.html`.
3. Si `window.DATA` existe en el `index.html` con tus filas, se pintará automáticamente. Si no, modifica `DATA_preview.json` con tu esquema `{"rows":[...]}` para probar.

> Nota: el front espera al menos los campos `Hotel`, `Persona` y `Fecha` (YYYY-MM-DD, YYYY-MM-DD HH:MM:SS o DD/MM/YYYY). Para el turno usa `Turno` (M/T/N/D) o `TurnoLargo`. Para ausencias acepta `TipoAusencia | Causa | Ausencia | Motivo | Tipo` y `Etiquetas`.
