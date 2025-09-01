@echo off
setlocal ENABLEDELAYEDEXPANSION

REM === Ir a la carpeta del script ===
pushd "%~dp0"

echo ==============================
echo   Turnos Web - Build rapido
echo ==============================

REM === Comprobar Python ===
where py >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No encuentro "py". Instala Python o agrega "py" al PATH.
  goto :end
)

REM === Comprobar scripts necesarios ===
set MISS=0
for %%F in (generar_turnos.py generar_index.py generar_live.py) do (
  if not exist "%%F" (
    echo [ERROR] Falta %%F
    set MISS=1
  )
)
if "!MISS!"=="1" goto :end

echo.
echo [1/3] Ejecutando generar_turnos.py...
py .\generar_turnos.py
if errorlevel 1 goto :end

echo.
echo [2/3] Ejecutando generar_index.py...
py .\generar_index.py
if errorlevel 1 goto :end

echo.
echo [3/3] Ejecutando generar_live.py...
py .\generar_live.py
if errorlevel 1 goto :end

echo.
echo ✅ Todo correcto. Abriendo index.html...
if exist "index.html" start "" "index.html"

goto :eof

:end
echo.
echo ❌ Proceso interrumpido. Revisa los mensajes anteriores.
popd
endlocal
