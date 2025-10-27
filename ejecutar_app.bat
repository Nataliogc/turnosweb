@echo off
setlocal EnableExtensions EnableDelayedExpansion
rem === Fijar raíz ===
cd /d "%~dp0"
set "ROOT=%~dp0"
if not exist "%ROOT%logs" mkdir "%ROOT%logs"
set "LOG=%ROOT%logs\app.log"
> "%LOG%" echo ==== INICIO %date% %time% ====

rem === Python ===
where python >nul 2>&1 && (set "PY=python") || (where py >nul 2>&1 && (set "PY=py -3") || (echo [ERROR] Python no encontrado & goto :fail))

rem === Timestamp ===
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do (set DD=%%a&set MM=%%b&set YY=%%c)
for /f "tokens=1-2 delims=: " %%h in ('time /t') do (set HH=%%h&set MN=%%i)
set "HH=%HH: =0%"
set "TS=%YY%%MM%%DD%_%HH%%MN%"

rem === 1) CSV + index ===
echo [1/6] CSV...>>"%LOG%"
%PY% "%ROOT%1_ExtraerDatosExcel.py" >>"%LOG%" 2>&1
echo [2/6] Generando index.html...>>"%LOG%"
%PY% "%ROOT%2_GenerarCuadranteHTML.py" >>"%LOG%" 2>&1
if not exist "%ROOT%index.html" (echo [ERROR] Falta index.html & goto :fail)

rem === 2) FULL_DATA -> data.js (raíz) ===
echo [3/6] Extrayendo FULL_DATA -> data.js >>"%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$h=Get-Content -LiteralPath '%ROOT%index.html' -Raw; if($h -match 'window\.FULL_DATA\s*=\s*\{(.|\n)*?\};'){ $m=$matches[0]; $out='// generado %env:TS%' + [Environment]::NewLine + $m; Set-Content -LiteralPath '%ROOT%data.js' -Encoding UTF8 -Value $out } else { throw 'No se encontro window.FULL_DATA' }" >>"%LOG%" 2>&1 || goto :fail

rem === 3) Inyectar data.js y versionar scripts en live.mobile.html ===
echo [4/6] Inyectando data.js en live.mobile.html >>"%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='%ROOT%live.mobile.html'; $t=Get-Content -LiteralPath $p -Raw; " ^
  "$t = $t -replace '<script\s+src\s*=\s*""data\.js[^""]*""\s*>\s*</script>',''; " ^
  "$t = $t -replace '(<!-- SI GENERAS DATOS INLINE, PÉGALOS AQUÍ -->\s*)','`$1`n  <script src=""data.js?v=%env:TS%""></script>`n'; " ^
  "$t = $t -replace 'mobile\.patch\.js[^""]*', 'mobile.patch.js?v=%env:TS%'; " ^
  "$t = $t -replace 'plantilla_adapter_semana\.js[^""]*', 'plantilla_adapter_semana.js?v=%env:TS%'; " ^
  "$t = $t -replace 'styles\.mobile\.css[^""]*', 'styles.mobile.css?v=%env:TS%'; " ^
  "Set-Content -LiteralPath $p -Encoding UTF8 -Value $t" >>"%LOG%" 2>&1

rem === 4) Bump service worker ===
echo [5/6] Versionando service-worker.js >>"%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='%ROOT%service-worker.js'; if(Test-Path $p){ $t=Get-Content -LiteralPath $p -Raw; $t=$t -replace 'turnosweb-app-v[^""]+','turnosweb-app-v%env:TS%'; Set-Content -LiteralPath $p -Encoding UTF8 -Value $t }" >>"%LOG%" 2>&1

rem === 5) Logos en /img/ ===
if not exist "%ROOT%img" mkdir "%ROOT%img"
if exist "%ROOT%guadiana logo.jpg" copy /y "%ROOT%guadiana logo.jpg" "%ROOT%img\guadiana.jpg" >nul
if exist "%ROOT%cumbria logo.jpg"  copy /y "%ROOT%cumbria logo.jpg"  "%ROOT%img\cumbria.jpg"  >nul

rem === 6) Servidor y abrir APP ===
start "" /min cmd /c "cd /d "%ROOT%" && %PY% -m http.server 8000"
start "" "http://localhost:8000/live.mobile.html"
echo Listo. Log: %LOG%
goto :eof

:fail
echo ERROR. Revisa "%LOG%"
exit /b 1
