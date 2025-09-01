Proyecto Turnos Web (mínimo y limpio)

Requisitos:
  py -m pip install -r requirements.txt

Excel origen:
  C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx

Generar y ver local:
  run_generar_index.bat
  (abre http://localhost:8800/index.html)

Publicar en GitHub:
  auto_update.bat

Notas:
- Se ignora la hoja “Datos de Validación”.
- Orden de hoteles y empleados = tal cual aparecen en el Excel.
- Se aplican todas las sustituciones con prioridad:
    1) Si hay TipoAusencia -> titular Ausente, sin cambios de turno. Se clona el turno del titular a los Sustitutos.
    2) Si no hay ausencia -> se aplican Cambios de turno y además se clona a Sustitutos.
- Resumen de NOCHES por mes al final de cada mes (ya con sustituciones).
