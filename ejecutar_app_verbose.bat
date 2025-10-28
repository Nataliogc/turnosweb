@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM =====================[ CONFIG INICIAL ]=====================
title Turnos APP · Generación e Inyección (modo verboso)
cd /d "%~dp0"
set "ROOT=%~dp0"
if not exist "%ROOT%logs" mkdir "%ROOT%logs"
set "LOG=%ROOT%logs\app.log"
break > "%LOG%"

set "OKCOUNT=0"
set "FAILCOUNT=0"

REM Funciones utilitarias
:print
echo %*
>> "%LOG%" echo %*
goto :eof

:step
call :print.
call :print =====================================================
call :print [STEP %1] %2
goto :eof

:checkfile
if exist "%~1" (
  call :print   [OK] %~1
  set /a OKCOUNT+=1
) else (
  call :print   [FALTA] %~1
  set /a FAILCOUNT+=1
)
goto :eof

call :print ==== INICIO %date% %time% ====
call :print Carpeta raíz: %ROOT%

REM =====================[ PYTHON ]=====================
call :step 1 "Detectando Python"
where python >nul 2>&1 && (set "PY=python") || (where py >nul 2>&1 && (set "PY=py -3") || (call :print [ERROR] Python no encontrado en PATH & goto :fail))
call :print   Usando: %PY%

REM =====================[ TIMESTAMP ]=====================
for /f "tokens=1-4 delims=/.- " %%a in ("%date%") do (set DD=%%a&set MM=%%b&set YY=%%c)
for /f "tokens=1-2 delims=:." %%h in ("%time%") do (set HH=%%h&set MN=%%i)
set "HH=%HH: =0%"
set "TS=%YY%%MM%%DD%_%HH%%MN%"
call :print   Timestamp: %TS%

REM =====================[ CSV + INDEX ]=====================
call :step 2 "Exportando CSV desde Excel (1_ExtraerDatosExcel.py)"
%PY% "%ROOT%1_ExtraerDatosExcel.py" >>"%LOG%" 2>&1
if errorlevel 1 call :print   (Aviso) 1_ExtraerDatosExcel.py devolvió código distinto de 0 (continuo)

call :step 3 "Generando index.html con datos embebidos (2_GenerarCuadranteHTML.py)"
%PY% "%ROOT%2_GenerarCuadranteHTML.py" >>"%LOG%" 2>&1
if not exist "%ROOT%index.html" (call :print [ERROR] No se generó index.html & goto :fail)
call :print   index.html generado OK

REM =====================[ EXTRAER FULL_DATA -> data.js ]=====================
call :step 4 "Extrayendo window.FULL_DATA a data.js"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$h=Get-Content -LiteralPath '%ROOT%index.html' -Raw; " ^
  "if($h -match 'window\.FULL_DATA\s*=\s*\{(.|\n)*?\};'){ $m=$matches[0]; $out='// generado %env:TS%' + [Environment]::NewLine + $m; Set-Content -LiteralPath '%ROOT%data.js' -Encoding UTF8 -Value $out } else { throw 'No se encontro window.FULL_DATA en index.html' }" >>"%LOG%" 2>&1
if errorlevel 1 (call :print [ERROR] No se pudo extraer FULL_DATA a data.js & goto :fail)
call :print   data.js creado

REM Sanidad de data.js (primeras líneas)
for /f "usebackq skip=0 delims=" %%L in ("%ROOT%data.js") do (
  set "FIRSTLINE=%%L"
  goto :afterpeek
)
:afterpeek
echo %FIRSTLINE% | find /i "window.FULL_DATA" >nul
if errorlevel 1 (call :print   [ADVERTENCIA] data.js no parece contener window.FULL_DATA (revisar) ) else (call :print   data.js contiene window.FULL_DATA ✓)

REM =====================[ INYECTAR EN APP ]=====================
call :step 5 "Inyectando versiones ?v= y data.js en live.mobile.html (APP)"
if not exist "%ROOT%live.mobile.html" (call :print [ERROR] Falta live.mobile.html (APP) & goto :fail)

REM Limpiar posibles scripts antiguos y añadir versionado
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='%ROOT%live.mobile.html'; $t=Get-Content -LiteralPath $p -Raw; " ^
  "$t = $t -replace '<script\s+src\s*=\s*""data\.js[^""]*""\s*>\s*</script>',''; " ^
  "$t = $t -replace '(<!-- SI GENERAS DATOS INLINE, PÉGALOS AQUÍ -->\s*)','`$1`n  <script src=""data.js?v=%env:TS%""></script>`n'; " ^
  "$t = $t -replace 'mobile\.patch\.js[^""]*', 'mobile.patch.js?v=%env:TS%'; " ^
  "$t = $t -replace 'plantilla_adapter_semana\.js[^""]*', 'plantilla_adapter_semana.js?v=%env:TS%'; " ^
  "$t = $t -replace 'styles\.mobile\.css[^""]*', 'styles.mobile.css?v=%env:TS%'; " ^
  "$t = $t -replace 'styles\.css[^""]*', 'styles.css?v=%env:TS%'; " ^
  "Set-Content -LiteralPath $p -Encoding UTF8 -Value $t" >>"%LOG%" 2>&1

call :print   Inyección de scripts completada

REM =====================[ SERVICE WORKER ]=====================
call :step 6 "Actualizando Service Worker (CACHE_NAME nuevo)"
if exist "%ROOT%service-worker.js" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$p='%ROOT%service-worker.js'; $t=Get-Content -LiteralPath $p -Raw; " ^
    "$t = $t -replace 'turnosweb-app-v[0-9_]+','turnosweb-app-v%env:TS%'; " ^
    "Set-Content -LiteralPath $p -Encoding UTF8 -Value $t" >>"%LOG%" 2>&1
  call :print   Service Worker versionado a turnosweb-app-v%TS%
) else (
  call :print   (Aviso) No se encontró service-worker.js (se omite)
)

REM =====================[ LOGOS APP ]=====================
call :step 7 "Asegurando logos de APP en .\img\"
if not exist "%ROOT%img" mkdir "%ROOT%img"
if exist "%ROOT%guadiana logo.jpg" copy /y "%ROOT%guadiana logo.jpg" "%ROOT%img\guadiana.jpg" >nul
if exist "%ROOT%cumbria logo.jpg"  copy /y "%ROOT%cumbria logo.jpg"  "%ROOT%img\cumbria.jpg"  >nul
call :print   Logos verificados

REM =====================[ VERIFICACIÓN FINAL ]=====================
call :step 8 "Verificación de ficheros clave (OK/FALTA)"
call :checkfile "%ROOT%index.html"
call :checkfile "%ROOT%live.mobile.html"
call :checkfile "%ROOT%data.js"
call :checkfile "%ROOT%styles.css"
call :checkfile "%ROOT%styles.mobile.css"
call :checkfile "%ROOT%plantilla_adapter_semana.js"
call :checkfile "%ROOT%mobile.patch.js"
call :checkfile "%ROOT%service-worker.js"
call :checkfile "%ROOT%icons\icon-192.png"
call :checkfile "%ROOT%icons\icon-512.png"
call :checkfile "%ROOT%img\guadiana.jpg"
call :checkfile "%ROOT%img\cumbria.jpg"

call :print -----------------------------------------------------
call :print Resumen:  OK=%OKCOUNT%   FALTAN=%FAILCOUNT%
if %FAILCOUNT% GTR 0 (
  call :print [ATENCIÓN] Faltan ficheros. Revisa la lista de [FALTA] y logs\app.log
) else (
  call :print Todo OK. Puedes abrir la APP.
)

REM =====================[ ARRANCAR SERVIDOR + ABRIR APP ]=====================
call :step 9 "Servidor local y apertura de la APP"
start "" /min cmd /c "cd /d "%ROOT%" && %PY% -m http.server 8000"
start "" "http://localhost:8000/live.mobile.html"
call :print.
call :print === FIN. Log detallado en: %LOG%
goto :eof

:fail
call :print.
call :print === FIN CON ERRORES. Revisa: %LOG%
exit /b 1
