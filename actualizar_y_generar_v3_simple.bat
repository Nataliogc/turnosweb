@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Turnos Web - Generar (v3 simple)

:: --- Carpeta del script ---
pushd "%~dp0"

:: --- Preparar carpeta de logs ---
if not exist "logs" mkdir "logs" >nul 2>&1
set "LOG=logs\build_latest.log"
echo === LOG Turnos Web (v3) === > "%LOG%"
echo Inicio: %date% %time% >> "%LOG%"
echo.>> "%LOG%"

:: --- Comprobar Python ---
where py >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [ERROR] No encuentro Python (py). Revisa PATH.
  echo [ERROR] No encuentro Python (py). >> "%LOG%"
  goto :end
)

:: --- Paso A: generar CSV si existe ---
if exist "2generar_turnos CSV.py" (
  echo [A] Ejecutando "2generar_turnos CSV.py"...
  py ".\2generar_turnos CSV.py" >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo [ERROR] Fallo al generar CSV (ver %LOG%)
    goto :end
  )
) else (
  echo [A] (Opcional) "2generar_turnos CSV.py" no encontrado. Sigo...
)

:: --- Paso B: generar_index.py ---
if not exist "generar_index.py" (
  echo [ERROR] Falta generar_index.py
  goto :end
)
echo [B] Ejecutando generar_index.py...
py .\generar_index.py >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [ERROR] generar_index.py fallo (ver %LOG%)
  goto :end
)

:: --- Paso C: generar_live.py ---
if not exist "generar_live.py" (
  echo [ERROR] Falta generar_live.py
  goto :end
)
echo [C] Ejecutando generar_live.py...
py .\generar_live.py >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [ERROR] generar_live.py fallo (ver %LOG%)
  goto :end
)

:: --- Verificación rápida de inyección DATA ---
for %%H in (index.html live.html) do (
  if exist "%%H" (
    findstr /c:"const DATA =" "%%H" >nul
    if errorlevel 1 (
      echo [WARN] No se encontro 'const DATA =' en %%H (¿se borro en la plantilla?)
    ) else (
      echo [OK] %%H contiene 'const DATA ='
    )
  ) else (
    echo [WARN] %%H no existe
  )
)

:: --- Abrir HTML ---
if exist "index.html" start "" "index.html"
if exist "live.html"  start "" "live.html"

echo.
echo [OK] Proceso terminado. Log: %LOG%
goto :ok

:end
echo.
echo [FALLO] Revisa el log: %LOG%

:ok
popd
endlocal
