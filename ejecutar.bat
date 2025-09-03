@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

rem ===== Consola/entorno =====
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set LOG=log_run.txt

rem Fecha/hora para commit
for /f "tokens=1-3 delims=/- " %%a in ("%date%") do set FECHA=%%c-%%b-%%a
for /f "tokens=1-2 delims=:.," %%a in ("%time%") do set HORA=%%a-%%b
set NOW=%FECHA%_%HORA%

echo === %DATE% %TIME% Inicio ===> "%LOG%"

rem ===== [1/5] Exportar CSV desde Excel =====
echo [1/5] Exportando turnos...
py ".\exportar_turnos_desde_excel.py" >> "%LOG%" 2>&1
if errorlevel 1 (
  echo ERROR: exportar_turnos_desde_excel.py fallo. Revisa "%LOG%".
  exit /b 1
)

rem ===== [2/5] Generar index desde plantilla (por compatibilidad) =====
echo [2/5] Generando index.html (plantilla)...
py ".\generar_index_CLEAN.py" >> "%LOG%" 2>&1

rem ===== [3/5] Generar live (UI completa) =====
echo [3/5] Generando live.html (UI completa)...
py ".\generar_live.py" >> "%LOG%" 2>&1
if errorlevel 1 (
  echo ERROR: generar_live.py fallo. Revisa "%LOG%".
  exit /b 1
)

rem ===== [4/5] Igualar formato bonito a index =====
echo [4/5] Copiando live.html -> index.html...
copy /y ".\live.html" ".\index.html" >nul

rem ===== [5/5] Publicar (opcional) =====
if exist ".\publicar.ps1" (
  echo [5/5] Ejecutando publicar.ps1...
  powershell -ExecutionPolicy Bypass -File ".\publicar.ps1" >> "%LOG%" 2>&1
)

rem ===== Limpieza: mover archivos innecesarios a _old y borrar temporales =====
echo Limpiando...
if not exist "_old" mkdir "_old" >nul 2>&1

rem Mover scripts viejos / pruebas
for %%F in (
  "generar_index.py"
  "generar_index_NEW.py"
  "generar_index_NEW.bak"
  "run_turnos.ps1"
  "0todo_en_un_click.ps1"
  "1actualizar.bat"
  "2generar_turnos CSV.py"
  "make.bat"
  "turnos_final_backup.html"
  "sustituciones_diagnostico.csv"
  "data_dump.json"
  "sanear_unicode.ps1"
) do (
  if exist "%%~F" move /y "%%~F" "_old\" >nul
)

rem Mover CSVs viejos con fecha
for %%F in ("turnos_mes_*.csv") do if exist "%%~F" move /y "%%~F" "_old\" >nul

rem Borrar logs viejos y cache python
del /q /f exportar_turnos.log 2>nul
del /q /f log_run.txt 2>nul
if exist "__pycache__" rmdir /s /q "__pycache__"

rem ===== Git: add/commit/push =====
echo Subiendo a GitHub...
git add -A
git commit -m "Auto: actualizacion turnos %NOW%" 1>nul 2>&1
git push 1>nul 2>&1

echo === %DATE% %TIME% Fin ===>> "%LOG%"
echo Listo. Abriendo index.html...
start "" ".\index.html"
exit /b 0

