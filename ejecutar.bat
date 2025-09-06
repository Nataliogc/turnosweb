@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if not exist logs mkdir logs

echo [1/2] Extrayendo datos desde Excel a CSV...
python -u "1_ExtraerDatosExcel.py" > "logs\1_exportacion.log" 2>&1
type "logs\1_exportacion.log"
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al extraer desde Excel. Revisa logs\1_exportacion.log
    pause
    exit /b 1
)

echo.
echo [2/2] Generando cuadrante completo y embebiendo en HTML...
python -u "2_GenerarCuadranteHTML.py" > "logs\2_generacion_html.log" 2>&1
type "logs\2_generacion_html.log"
if %errorlevel% neq 0 (
    echo [ERROR] Fallo al generar el HTML. Revisa logs\2_generacion_html.log
    pause
    exit /b 1
)

echo.
echo Abriendo resultado en index.html...
start "" "%~dp0index.html"

echo ---------------------------------------------
echo Proceso completado AUTOMATICAMENTE.
echo ---------------------------------------------
pause