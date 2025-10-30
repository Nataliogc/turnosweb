@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Turnos Web · Build + Serve (PWA)

rem ────────────────────────────────────────────────────────────────────────────
rem 1) Preparativos
rem ────────────────────────────────────────────────────────────────────────────
cd /d "%~dp0"
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmm"') do set VER=%%I
set APP_NAME=turnosweb-app-v%VER%

if not exist logs mkdir logs >nul 2>&1
set LOG=logs\build_%VER%.log

echo === Turnos Web · %DATE% %TIME% · v%VER% === > "%LOG%"
echo Carpeta: %CD% >> "%LOG%"

rem Detectar Python (py o python)
set PY=python
where py >nul 2>&1 && set PY=py
echo Python usado: %PY% >> "%LOG%"

rem ────────────────────────────────────────────────────────────────────────────
rem 2) Generar datos desde Excel (si usas el pipeline)
rem ────────────────────────────────────────────────────────────────────────────
if exist "1_ExtraerDatosExcel.py" (
  echo [1/4] Exportando CSV desde Excel... | tee -a "%LOG%"
  %PY% 1_ExtraerDatosExcel.py >> "%LOG%" 2>&1
) else (
  echo [1/4] Omitido: 1_ExtraerDatosExcel.py no existe. | tee -a "%LOG%"
)

if exist "2_GenerarCuadranteHTML.py" (
  echo [2/4] Generando data.js e index.html... | tee -a "%LOG%"
  %PY% 2_GenerarCuadranteHTML.py >> "%LOG%" 2>&1
) else (
  echo [2/4] Omitido: 2_GenerarCuadranteHTML.py no existe. | tee -a "%LOG%"
)

rem ────────────────────────────────────────────────────────────────────────────
rem 3) Actualizar versión (?v=YYYYMMDD_HHMM) y CACHE_NAME del SW
rem ────────────────────────────────────────────────────────────────────────────
if exist "live.mobile.html" (
  copy /y "live.mobile.html" "live.mobile.html.bak" >nul

  rem Reemplazos robustos (soporta APP o números previos)
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ver='%VER%';" ^
    "$f='live.mobile.html';" ^
    "$c=Get-Content $f -Raw;" ^
    "$c=$c -replace 'data\.js\?v=APP','data.js?v='+$ver;" ^
    "$c=$c -replace 'mobile\.patch\.js\?v=APP','mobile.patch.js?v='+$ver;" ^
    "$c=$c -replace 'plantilla_adapter_semana\.js\?v=APP','plantilla_adapter_semana.js?v='+$ver;" ^
    "$c=$c -replace 'data\.js\?v=\d{8}_\d{4}','data.js?v='+$ver;" ^
    "$c=$c -replace 'mobile\.patch\.js\?v=\d{8}_\d{4}','mobile.patch.js?v='+$ver;" ^
    "$c=$c -replace 'plantilla_adapter_semana\.js\?v=\d{8}_\d{4}','plantilla_adapter_semana.js?v='+$ver;" ^
    "$c=$c -replace 'styles\.css\?v=\d{8}_\d{4}','styles.css?v='+$ver;" ^
    "$c=$c -replace 'styles\.mobile\.css\?v=\d{8}_\d{4}','styles.mobile.css?v='+$ver;" ^
    "Set-Content -NoNewline -Path $f -Value $c;"
) else (
  echo [WARN] live.mobile.html no encontrado. >> "%LOG%"
)

if exist "service-worker.js" (
  copy /y "service-worker.js" "service-worker.js.bak" >nul
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$name='turnosweb-app-v'+'%VER%';" ^
    "(Get-Content 'service-worker.js' -Raw) -replace 'const\s+CACHE_NAME\s*=\s*\"[^\"]+\"','const CACHE_NAME = \"'+$name+'\"' | Set-Content -NoNewline 'service-worker.js';"
) else (
  echo [WARN] service-worker.js no encontrado. >> "%LOG%"
)

rem ────────────────────────────────────────────────────────────────────────────
rem 4) Servidor local y apertura en navegador
rem ────────────────────────────────────────────────────────────────────────────
echo [4/4] Levantando servidor local en http://localhost:8000 ... | tee -a "%LOG%"
start "" cmd /c "%PY% -m http.server 8000 >> \"%LOG%\" 2>&1"
timeout /t 1 >nul
start "" "http://localhost:8000/live.mobile.html"

echo ---
echo Listo. Version: %VER%
echo - Se ha abierto la app en el navegador.
echo - Log: %LOG%
echo ---
endlocal
exit /b 0

:tee
rem Uso: somecommand | tee -a "file.log"
more +1 >nul 2>&1
