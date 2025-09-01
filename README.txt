INSTRUCCIONES (Windows)

1) Instala dependencias si no las tienes:
   - Abre PowerShell o CMD
   - pip install pandas openpyxl

2) Copia "generar_index.py" y "run_generar_index.bat" a una carpeta (por ejemplo, C:\Users\comun\Documents\Turnos web).

3) Edita la variable EXCEL_PATH dentro de generar_index.py si la ruta cambia. Ahora mismo está puesta en:
   C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx

4) Ejecuta con doble clic el archivo:
   run_generar_index.bat

5) Si todo va bien, verás un mensaje "OK -> ..." y tendrás un index.html en la misma carpeta.
   Ábrelo con tu navegador. Verás pestañas para cada hotel y una para Sustituciones, con buscador.
   
NOTAS:
- No pegues código Python directamente en PowerShell: ejecuta el .py con el .bat o con "py -3 generar_index.py".
- El script NO reordena nada: respeta el orden tal como aparece en cada hoja.
- La hoja "Sustituciones" se muestra con las columnas: Hotel, Fecha (YYYY-MM-DD), Empleado, Cambio de Turno, Sustituto, Tipo Ausencia.
- Si alguna columna/celda no existe, se deja en blanco.
