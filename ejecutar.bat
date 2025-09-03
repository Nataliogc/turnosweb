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

rem ===== [1/6] Exportar CSV desde Excel =====
echo [1/6] Exportando turnos...
py ".\exportar_turnos_desde_excel.py" >> "%LOG%" 2>&1
if errorlevel 1 (
  echo ERROR: exportar_turnos_desde_excel.py fallo. Revisa "%LOG%".
  exit /b 1
)

rem ===== [2/6] Generar index desde plantilla (compatibilidad / fallback) =====
echo [2/6] Generando index.html (plantilla)...
py ".\generar_index_CLEAN.py" >> "%LOG%" 2>&1

rem ===== [3/6] Generar live (UI completa) =====
echo [3/6] Generando live.html (UI completa)...
py ".\generar_live.py" >> "%LOG%" 2>&1
if errorlevel 1 (
  echo ERROR: generar_live.py fallo. Revisa "%LOG%".
  exit /b 1
)

rem ===== [4/6] Igualar formato bonito a index =====
echo [4/6] Copiando live.html -> index.html...
copy /y ".\live.html" ".\index.html" >nul

rem ===== [5/6] Publicar (opcional) tareas previas, si existe publicar.ps1 =====
if exist ".\publicar.ps1" (
  echo [5/6] Ejecutando publicar.ps1...
  powershell -ExecutionPolicy Bypass -File ".\publicar.ps1" >> "%LOG%" 2>&1
)

rem ===== [6/6] Limpieza =====
echo [6/6] Limpiando...
if not exist "_old" mkdir "_old" >nul 2>&1

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

for %%F in ("turnos_mes_*.csv") do if exist "%%~F" move /y "%%~F" "_old\" >nul

rem logs antiguos / cache
del /q /f exportar_turnos.log 2>nul
if exist "__pycache__" rmdir /s /q "__pycache__" 2>nul

rem ===== Git: add/commit/push =====
echo Subiendo a GitHub...
git add -A
git commit -m "Auto: actualizacion turnos %NOW%" 1>nul 2>&1
git push 1>nul 2>&1

echo === %DATE% %TIME% Fin ===>> "%LOG%"
echo Listo. Abriendo index.html...
start "" ".\index.html"
exit /b 0
