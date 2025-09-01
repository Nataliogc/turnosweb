CUADRANTE AVANZADO — INSTRUCCIONES

1) Requisitos
   - Python 3.x instalado
   - pip install pandas openpyxl python-dateutil

2) Copia estos archivos a tu carpeta de trabajo (p.ej. C:\Users\comun\Documents\Turnos web)
   - generar_index.py
   - run_generar_index.bat

3) Abre generar_index.py si necesitas ajustar:
   - EXCEL_PATH  -> ruta del Excel
   - SHIFT_DEFAULTS -> horas por defecto para M/T/N

4) Ejecuta con doble clic:
   run_generar_index.bat

5) Abre index.html generado.
   Verás:
   - Barra superior con "Actualizado"
   - Filtros: Buscar, Hotel, Desde/Hasta (por defecto hoy a +30 días), Empleado
   - Botones: Limpiar, Descargar .ics (exporta eventos filtrados, omite descansos)
   - Leyenda de colores
   - Lista de resultados (empleado — hotel / fecha — código — horas)

PARSEO DEL EXCEL
- Se detecta automáticamente la fila de encabezados con fechas (si hay ≥3 fechas).
- La columna de empleado se toma como la situada a la izquierda de la primera fecha.
- Se respetan los nombres y el orden de filas del Excel, sin ordenar alfabéticamente.
- La hoja "Sustituciones" marca ausencias y anota sustituto/causa si coincide hotel+empleado+fecha.
- Si aparece una ausencia en "Sustituciones" que no tiene celda en el cuadrante, se crea un evento virtual (sin horario).

CÓDIGOS DE TURNO
- M/T/N reconocidos (Mañana/Tarde/Noches) con horas por defecto configurables.
- "D", "DESC", "DESCANSO" -> Descanso (no exporta a .ics).
- "V", "VAC", "VACACIONES", "B", "BAJA", "PERM", "PERMISO", "AUS", "AUSENCIA" -> Ausencia.
- Cualquier otro código -> "Turno" genérico (09:00–17:00 por defecto).

NOTAS
- Si tu plantilla usa otros códigos (p.ej. "L" para libre, "X" etc.), añade al diccionario CODE_MAP y, si procede, a SHIFT_DEFAULTS.
- Si tus horarios de turnos difieren, edítalos en SHIFT_DEFAULTS.
- Si no aparece nada y sale la franja roja "No hay datos...", revisa que haya fechas válidas en las cabeceras de las hojas de hotel.
