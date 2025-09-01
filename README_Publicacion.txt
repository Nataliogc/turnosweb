Turnos Web – Últimos archivos válidos
=====================================
- index.html                → Visualización actual (sin cambios).
- generar_turnos.py         → Reescribe 'sustituciones_diagnostico.csv' leyendo 'Sustituciones' del Excel en OneDrive.
                              Fechas ES + bloqueos OneDrive. No crea carpetas ni HTML.
- publicar.ps1              → pull + commit PUSH de index.html si cambió.
- ejecutar_diagnostico.bat  → atajo para ejecutar el generador en consola.
- requirements.txt          → pandas, openpyxl.

Flujo rápido:
1) Doble clic en 'ejecutar_diagnostico.bat' (o 'py -u generar_turnos.py').
2) Doble clic en 'publicar.ps1' para subir a GitHub (si index.html cambió).
