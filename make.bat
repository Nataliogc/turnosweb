@echo off
setlocal ENABLEDELAYEDEXPANSION

REM === Ir a la carpeta del script ===
pushd "%~dp0"

echo ==============================
echo   Turnos Web - Build completo
echo ==============================

REM =========================
REM   Comprobaciones basicas
REM =========================
where py >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No encuentro "py". Instala Python o agrega "py" al PATH.
  goto :end
)

set MISS=0
for %%F in ("2generar_turnos CSV.py" generar_index.py generar_live.py) do (
  if not exist %%F (
    echo [ERROR] Falta %%F
    set MISS=1
  )
)
if "!MISS!"=="1" goto :end

echo.
echo [1/4] Generando/actualizando CSV de sustituciones desde Excel...
py ".\2generar_turnos CSV.py"
if errorlevel 1 (
  echo [ERROR] Fallo al generar "sustituciones_diagnostico.csv"
  goto :end
)

echo.
echo [2/4] Generando datos para index.html...
py .\generar_index.py
if errorlevel 1 goto :end

echo.
echo [3/4] Generando datos para live.html...
py .\generar_live.py
if errorlevel 1 goto :end

echo.
echo [4/4] Abriendo index.html...
if exist "index.html" start "" "index.html"

echo.
echo ✅ Proceso completado correctamente.
goto :eof

:end
echo.
echo ❌ Proceso interrumpido. Revisa los mensajes anteriores.
popd
endlocal
