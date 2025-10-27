@echo off
chcp 65001 >nul
title Generador de Cuadrantes · v12

echo ==================================================
echo    GENERADOR DE CUADRANTES · HOTELES DE CALIDAD
echo ==================================================
echo.

echo [1/4] Extrayendo datos de Excel...
python "1_ExtraerDatosExcel.py"
if errorlevel 1 (
  echo ❌ Error al extraer datos.
  pause & exit /b
)

echo [2/4] Generando cuadrante HTML...
python "2_GenerarCuadranteHTML.py"
if errorlevel 1 (
  echo ❌ Error al generar cuadrante HTML.
  pause & exit /b
)

set DEST=turnosweb
if not exist "%DEST%" mkdir "%DEST%"

echo [3/4] Copiando a "%DEST%"...
copy /Y "live.html"           "%DEST%\live.html"           >nul
copy /Y "live.mobile.html"    "%DEST%\live.mobile.html"    >nul
copy /Y "styles.css"          "%DEST%\styles.css"          >nul
copy /Y "styles.mobile.css"   "%DEST%\styles.mobile.css"   >nul
copy /Y "mobile.patch.js"     "%DEST%\mobile.patch.js"     >nul
copy /Y "manifest.json"       "%DEST%\manifest.json"       >nul
copy /Y "service-worker.js"   "%DEST%\service-worker.js"   >nul
copy /Y "index.html"          "%DEST%\index.html"          >nul
if exist "icons" xcopy /E /I /Y "icons" "%DEST%\icons" >nul

echo [4/4] Publicación local completada.
echo ✅ Escritorio: live.html | APP: live.mobile.html
echo Abre: https://nataliogc.github.io/turnosweb/live.html?v=12  (escritorio)
echo Abre: https://nataliogc.github.io/turnosweb/live.mobile.html?v=12  (móvil/app)
echo.
pause
