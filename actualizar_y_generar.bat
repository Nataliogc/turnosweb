@echo off
setlocal ENABLEDELAYEDEXPANSION
title Turnos Web - Actualizar y Generar

:: ================= Header =================
set "START_TS=%date% %time%"
echo ===============================================
echo   Turnos Web - Actualizar y Generar (unificado)
echo   Inicio: %START_TS%
echo ===============================================
echo.

:: ------------- Parse switches --------------
:: /NOCSV   -> no ejecutar "2generar_turnos CSV.py"
:: /NOOPEN  -> no abrir index.html al final
:: /NOUPDATE-> no ejecutar 1actualizar.bat
set "DO_CSV=1"
set "DO_OPEN=1"
set "DO_UPDATE=1"
for %%A in (%*) do (
  if /I "%%~A"=="/NOCSV"   set "DO_CSV=0"
  if /I "%%~A"=="/NOOPEN"  set "DO_OPEN=0"
  if /I "%%~A"=="/NOUPDATE" set "DO_UPDATE=0"
)

:: --------------- Go to script folder ---------------
pushd "%~dp0"

:: --------------- Checks ---------------
where py >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No encuentro "py". Instala Python o agrega "py" al PATH.
  goto :end
)

set MISS=0
for %%F in (generar_index.py generar_live.py) do (
  if not exist "%%F" (
    echo [ERROR] Falta %%F
    set MISS=1
  )
)
if "!MISS!"=="1" goto :end

:: ------- (1) Actualizar si existe 1actualizar.bat -------
if "%DO_UPDATE%"=="1" (
  if exist "1actualizar.bat" (
    echo [1/5] Ejecutando 1actualizar.bat ...
    call ".\1actualizar.bat"
    if errorlevel 1 (
      echo [WARN] 1actualizar.bat devolvio error. Continuo...
    )
    echo.
  ) else (
    echo [1/5] 1actualizar.bat no encontrado. (OK)
    echo.
  )
) else (
  echo [1/5] /NOUPDATE activado. Omitiendo actualizacion.
  echo.
)

:: ------- (2) Generar CSV si existe "2generar_turnos CSV.py" -------
if "%DO_CSV%"=="1" (
  if exist "2generar_turnos CSV.py" (
    echo [2/5] Generando CSV de sustituciones ...
    py ".\2generar_turnos CSV.py"
    if errorlevel 1 (
      echo [ERROR] Fallo al generar "sustituciones_diagnostico.csv"
      goto :end
    )
    echo.
  ) else (
    echo [2/5] "2generar_turnos CSV.py" no encontrado. (OK, continuo)
    echo.
  )
) else (
  echo [2/5] /NOCSV activado. Omitiendo generacion de CSV.
  echo.
)

:: ------- (3) generar_index.py -------
echo [3/5] Ejecutando generar_index.py ...
py .\generar_index.py
if errorlevel 1 goto :end
echo.

:: ------- (4) generar_live.py -------
echo [4/5] Ejecutando generar_live.py ...
py .\generar_live.py
if errorlevel 1 goto :end
echo.

:: ------- (5) Abrir index.html (opcional) -------
if "%DO_OPEN%"=="1" (
  if exist "index.html" (
    echo [5/5] Abriendo index.html ...
    start "" "index.html"
  ) else (
    echo [5/5] index.html no encontrado para abrir.
  )
) else (
  echo [5/5] /NOOPEN activado. No se abrira el navegador.
)
echo.

goto :ok

:ok
set "END_TS=%date% %time%"
echo ===============================================
echo   Todo correcto. Fin: %END_TS%
echo ===============================================
popd
endlocal
exit /b 0

:end
set "END_TS=%date% %time%"
echo.
echo ❌ Proceso interrumpido. Fin: %END_TS%
popd
endlocal
exit /b 1
