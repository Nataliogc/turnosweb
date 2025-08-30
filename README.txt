TURNOS WEB — Paquete actualizado (Vacaciones + Noches)

Carpeta objetivo del proyecto (coloca estos ficheros aquí, sobrescribiendo si existen):
C:\Users\comun\Documents\Turnos web\

CONTENIDO
---------
1) generar_turnos.py
   - Lee el Excel maestro (solo lectura) de:
     C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx
   - Escribe SOLO sustituciones_diagnostico.csv en la carpeta del proyecto.

2) actualizar.ps1 / actualizar.bat
   - Ejecuta el generador y publica a GitHub si hay cambios.
   - Si PowerShell bloquea el .ps1: usa actualizar.bat o
     Unblock-File .\actualizar.ps1

3) vacaciones_noches_patch_v2.js
   - Parche JS que añade overlay de "Vacaciones 🏖️" y el recuento de noches (🌙).
   - Inserta la línea de carga en tu index.html justo antes de </body>:
       <script src="./vacaciones_noches_patch_v2.js" defer></script>

4) parchear_index.ps1
   - Inserta automáticamente la línea anterior en .\index.html (si no existe).

5) abrir_local.bat
   - Abre la página en http://localhost:8800/index.html
   - Levanta el servidor local (necesario para que fetch() lea el CSV).

6) requirements.txt
   - Dependencias de Python para el generador (pandas, openpyxl, numpy).

USO RÁPIDO
----------
1) Generar CSV en la carpeta del proyecto:
   py -u .\generar_turnos.py

2) Parchear tu index.html (solo la primera vez):
   .\parchear_index.ps1
   (o inserta a mano en tu index.html:
    <script src="./vacaciones_noches_patch_v2.js" defer></script> )

3) Probar en local:
   .\abrir_local.bat
   (si ya tienes server, abre: http://localhost:8800/index.html y recarga con Ctrl+F5)

4) Publicar a GitHub:
   .\actualizar.bat
   (o: powershell -NoProfile -ExecutionPolicy Bypass -File .\actualizar.ps1)

NOTAS
-----
- Asegúrate de que "sustituciones_diagnostico.csv" queda JUNTO a tu index.html.
- Si tu archivo se llama index.htm, igualmente sirve:
  añade el <script> también en index.htm o renómbralo a index.html.
- El panel blanco de diagnóstico aparece abajo a la derecha.
  Si indica "CSV no accesible", abre http://localhost:8800/sustituciones_diagnostico.csv
  para confirmar que el CSV está en la carpeta y el servidor lo sirve (200 OK).
