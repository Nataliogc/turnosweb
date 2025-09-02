@echo off
setlocal ENABLEDELAYEDEXPANSION
title Turnos Web - Actualizar y Generar (v2 seguro)

REM ==============================================
REM   Switches:
REM     /UPDATE  -> ejecutar 1actualizar.bat (por defecto NO)
REM     /NOCSV   -> no ejecutar "2generar_turnos CSV.py"
REM     /NOOPEN  -> no abrir HTML al final
REM ==============================================

set "DO_UPDATE=0"
set "DO_CSV=1"
set "DO_OPEN=1"

for %%A in (%*) do (
  if /I "%%~A"=="/UPDATE" set "DO_UPDATE=1"
  if /I "%%~A"=="/NOCSV"  set "DO_CSV=0"
  if /I "%%~A"=="/NOOPEN" set "DO_OPEN=0"
)

pushd "%~dp0"

if not exist "logs" mkdir "logs" >nul 2>&1
set "TS=%date%_%time%"
set "TS=%TS:/=-%"
set "TS=%TS::=-%"
set "TS=%TS:.=-%"
set "TS=%TS:,=-%"
set "TS=%TS: =0%"
set "LOGFILE=logs\build_%TS%.log"

echo === LOG Turnos Web (v2) === > "%LOGFILE%"
echo Inicio: %date% %time% >> "%LOGFILE%"
echo Args: %* >> "%LOGFILE%"
echo.>> "%LOGFILE%"

where py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
  echo [ERROR] No encuentro Python (py).
  echo [ERROR] No encuentro Python (py). >> "%LOGFILE%"
  goto :end
)

REM --------- (1) OPCIONAL: 1actualizar.bat ---------
if "%DO_UPDATE%"=="1" (
  if exist "1actualizar.bat" (
    echo [1/6] Ejecutando 1actualizar.bat ...
    call ".\1actualizar.bat" >> "%LOGFILE%" 2>&1
    echo.
  ) else (
    echo [1/6] 1actualizar.bat no encontrado. (OK)
    echo [INFO] 1actualizar.bat no encontrado >> "%LOGFILE%"
    echo.
  )
) else (
  echo [1/6] /UPDATE no indicado. Omitiendo 1actualizar.bat.
  echo [INFO] UPDATE omitido >> "%LOGFILE%"
  echo.
)

REM --------- (2) CSV: "2generar_turnos CSV.py" ---------
if "%DO_CSV%"=="1" (
  if exist "2generar_turnos CSV.py" (
    echo [2/6] Generando CSV (2generar_turnos CSV.py) ...
    py ".\2generar_turnos CSV.py" >> "%LOGFILE%" 2>&1
    if errorlevel 1 (
      echo [ERROR] Fallo al generar CSV. Ver log.
      goto :end
    )
    echo.
  ) else (
    echo [2/6] "2generar_turnos CSV.py" no encontrado. Continuo.
    echo [WARN] Falta 2generar_turnos CSV.py >> "%LOGFILE%"
    echo.
  )
) else (
  echo [2/6] /NOCSV activado. Omitiendo generacion de CSV.
  echo [INFO] /NOCSV activado >> "%LOGFILE%"
  echo.
)

REM --------- (3) generar_index.py ---------
if not exist "generar_index.py" (
  echo [ERROR] Falta generar_index.py
  goto :end
)
echo [3/6] Ejecutando generar_index.py ...
py .\generar_index.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
  echo [ERROR] generar_index.py fallo. Ver log.
  goto :end
)
echo.

REM --------- (4) generar_live.py ---------
if not exist "generar_live.py" (
  echo [ERROR] Falta generar_live.py
  goto :end
)
echo [4/6] Ejecutando generar_live.py ...
py .\generar_live.py >> "%LOGFILE%" 2>&1
if errorlevel 1 (
  echo [ERROR] generar_live.py fallo. Ver log.
  goto :end
)
echo.

REM --------- (5) Verificacion de DATA en HTML ---------
for %%H in (index.html live.html) do (
  if exist "%%H" (
    for /f "usebackq tokens=1,* delims=:" %%L in (`powershell -NoProfile -Command "(Select-String -Path '%%H' -Pattern 'const DATA =').Line.Length"`) do (
      set "LEN=%%M"
    )
    if not defined LEN set "LEN=0"
    echo [5/6] %%H -> longitud bloque DATA: !LEN!
    if "!LEN!"=="0" (
      echo [ERROR] No se encontro 'const DATA =' en %%H. Verifica plantillas.
      goto :end
    )
    set "LEN="
  ) else (
    echo [5/6] %%H no existe.
    goto :end
  )
)

REM --------- (6) Abrir HTML ---------
if "%DO_OPEN%"=="1" (
  if exist "index.html" start "" "index.html"
  if exist "live.html"  start "" "live.html"
) else (
  echo [6/6] /NOOPEN activado. No se abrira el navegador.
)

echo.
echo [OK] Proceso completado. Log: %LOGFILE%
goto :ok

:ok
popd
endlocal
exit /b 0

:end
echo.
echo [FALLO] Revisa el log: %LOGFILE%
popd
endlocal
exit /b 1
