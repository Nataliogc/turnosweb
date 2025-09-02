@echo off
setlocal ENABLEDELAYEDEXPANSION
title Turnos Web - Actualizar y Generar (unificado + log)

:: ================= Header =================
set "START_TS=%date% %time%"
echo ===============================================
echo   Turnos Web - Actualizar y Generar (unificado)
echo   Inicio: %START_TS%
echo ===============================================
echo.

:: ------------- Parse switches --------------
:: /NOCSV   -> no ejecutar "2generar_turnos CSV.py"
:: /NOOPEN  -> no abrir HTML al final
:: /NOUPDATE-> no ejecutar 1actualizar.bat
set "DO_CSV=1"
set "DO_OPEN=1"
set "DO_UPDATE=1"
for %%A in (%*) do (
  if /I "%%~A"=="/NOCSV"    set "DO_CSV=0"
  if /I "%%~A"=="/NOOPEN"   set "DO_OPEN=0"
  if /I "%%~A"=="/NOUPDATE" set "DO_UPDATE=0"
)

:: --------------- Go to script folder ---------------
pushd "%~dp0"

:: --------------- Logging ---------------
if not exist "logs" mkdir "logs" >nul 2>&1
set "TS=%date%_%time%"
:: sanitize TS for filename
set "TS=%TS:/=-%"
set "TS=%TS::=-%"
set "TS=%TS:.=-%"
set "TS=%TS:,=-%"
set "TS=%TS: =0%"
set "LOGFILE=logs\build_%TS%.log"
echo [LOG] Escribiendo log en "%LOGFILE%"
echo === LOG Turnos Web === > "%LOGFILE%"
echo Inicio: %START_TS% >> "%LOGFILE%"
echo Args: %* >> "%LOGFILE%"
echo.>> "%LOGFILE%"

:: --------------- Checks ---------------
where py >>"%LOGFILE%" 2>&1
if errorlevel 1 (
  echo [ERROR] No encuentro "py". Instala Python o agrega "py" al PATH.
  echo [ERROR] No encuentro "py" >> "%LOGFILE%"
  goto :end
)

set MISS=0
for %%F in (generar_index.py generar_live.py) do (
  if not exist "%%F" (
    echo [ERROR] Falta %%F
    echo [ERROR] Falta %%F >> "%LOGFILE%"
    set MISS=1
  )
)
if "!MISS!"=="1" goto :end

:: ------- (1) Actualizar si existe 1actualizar.bat -------
if "%DO_UPDATE%"=="1" (
  if exist "1actualizar.bat" (
    echo [1/6] Ejecutando 1actualizar.bat ...
    call ".\1actualizar.bat" >> "%LOGFILE%" 2>&1
    if errorlevel 1 (
      echo [WARN] 1actualizar.bat devolvio error. Continuo...
      echo [WARN] 1actualizar.bat devolvio error. >> "%LOGFILE%"
    )
    echo.
  ) else (
    echo [1/6] 1actualizar.bat no encontrado. (OK)
    echo [INFO] 1actualizar.bat no encontrado >> "%LOGFILE%"
    echo.
  )
) else (
  echo [1/6] /NOUPDATE activado. Omitiendo actualizacion.
  echo [INFO] /NOUPDATE activado >> "%LOGFILE%"
  echo.
)

:: ------- (2) Generar CSV si existe "2generar_turnos CSV.py" -------
if "%DO_CSV%"=="1" (
  if exist "2generar_turnos CSV.py" (
    echo [2/6] Generando CSV de sustituciones ...
    py ".\2generar_turnos CSV.py" >> "%LOGFILE%" 2>&1
    if errorlevel 1 (
      echo [ERROR] Fallo al generar "sustituciones_diagnostico.csv"
      echo [ERROR] Fallo al generar "sustituciones_diagnostico.csv" >> "%LOGFILE%"
      goto :end
    )
    echo.
  ) else (
    echo [2/6] "2generar_turnos CSV.py" no encontrado. (OK, continuo)
    echo [INFO] 2generar_turnos CSV.py no encontrado >> "%LOGFILE%"
    echo.
  )
) else (
  echo [2/6] /NOCSV activado. Omitiendo generacion de CSV.
  echo [INFO] /NOCSV activado >> "%LOGFILE%"
  echo.
)

:: ------- (3) generar_index.py -------
echo [3/6] Ejecutando generar_index.py ...
py .\generar_index.py >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :end
echo.

:: ------- (4) generar_live.py -------
echo [4/6] Ejecutando generar_live.py ...
py .\generar_live.py >> "%LOGFILE%" 2>&1
if errorlevel 1 goto :end
echo.

:: ------- (5) Mostrar ultimas lineas del log -------
echo [5/6] Resumen:
for /f "usebackq tokens=* delims=" %%L in (`powershell -NoProfile -Command "Get-Content -Tail 6 '%CD%\%LOGFILE%'"`) do @echo   %%L

:: ------- (6) Abrir HTML (opcional) -------
if "%DO_OPEN%"=="1" (
  set "OPENED=0"
  if exist "index.html" (
    start "" "index.html"
    set "OPENED=1"
  )
  if exist "live.html" (
    start "" "live.html"
    set "OPENED=1"
  )
  if "!OPENED!"=="0" echo [6/6] No se encontraron HTML para abrir.
) else (
  echo [6/6] /NOOPEN activado. No se abrira el navegador.
)

goto :ok

:ok
set "END_TS=%date% %time%"
echo.
echo ===============================================
echo   Todo correcto. Fin: %END_TS%
echo   Log: %LOGFILE%
echo ===============================================
popd
endlocal
exit /b 0

:end
set "END_TS=%date% %time%"
echo.
echo ❌ Proceso interrumpido. Fin: %END_TS%
echo   Revisa el log: %LOGFILE%
popd
endlocal
exit /b 1
