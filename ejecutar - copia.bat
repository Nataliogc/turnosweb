@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem === 0) Fijar raíz (soporta espacios)
cd /d "%~dp0"
set "ROOT=%~dp0"
set "LOG=%ROOT%logs\app.log"
if not exist "%ROOT%logs" mkdir "%ROOT%logs"
> "%LOG%" echo ==== INICIO %date% %time% ====

rem === 1) Python
where python >nul 2>&1 && (set "PY=python") || (where py >nul 2>&1 && (set "PY=py -3") || (echo [ERROR] Python no encontrado & goto :fail))

rem === 2) Timestamp cache-busting
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do (set DD=%%a&set MM=%%b&set YY=%%c)
for /f "tokens=1-2 delims=: " %%h in ('time /t') do (set HH=%%h&set MN=%%i)
set "HH=%HH: =0%"
set "TS=%YY%%MM%%DD%_%HH%%MN%"

rem === 3) CSV + index.html
echo [1/5] CSV...>>"%LOG%"
%PY% "%ROOT%1_ExtraerDatosExcel.py" >>"%LOG%" 2>&1
echo [2/5] Generando index.html...>>"%LOG%"
%PY% "%ROOT%2_GenerarCuadranteHTML.py" >>"%LOG%" 2>&1
if not exist "%ROOT%index.html" (echo [ERROR] Falta index.html & goto :fail)

rem === 4) Extraer FULL_DATA a data.js (en la RAIZ)
echo [3/5] Extrayendo FULL_DATA -> data.js >>"%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$html=Get-Content -LiteralPath '%ROOT%index.html' -Raw; " ^
  "if($html -match 'window\.FULL_DATA\s*=\s*\{(.|\n)*?\};'){ $m=$matches[0]; $out='// generado %env:TS%' + [Environment]::NewLine + $m; Set-Content -LiteralPath '%ROOT%data.js' -Encoding UTF8 -Value $out } else { throw 'No se encontro window.FULL_DATA' }" >>"%LOG%" 2>&1 || goto :fail

rem === 5) Inyectar <script src="data.js?v=TS"> en live.mobile.html (APP raiz)
echo [4/5] Inyectando data.js en live.mobile.html >>"%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='%ROOT%live.mobile.html'; $t=Get-Content -LiteralPath $p -Raw; " ^
  "$t = $t -replace '<script\s+src\s*=\s*""data\.js[^""]*""\s*>\s*</script>',''; " ^
  "$t = $t -replace '(<!-- SI GENERAS DATOS INLINE, PÉGALOS AQUÍ -->\s*)','`$1`n  <script src=""data.js?v=%env:TS%""></script>`n'; " ^
  "Set-Content -LiteralPath $p -Encoding UTF8 -Value $t" >>"%LOG%" 2>&1

rem === 6) Bump service-worker.js (en la RAIZ)
echo [5/5] Versionando service-worker.js >>"%LOG%"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='%ROOT%service-worker.js'; if(Test-Path $p){ $t=Get-Content -LiteralPath $p -Raw; $t=$t -replace 'CACHE_NAME\s*=\s*""turnosweb-app-v[^""]+""','CACHE_NAME = ""turnosweb-app-v%env:TS%""'; Set-Content -LiteralPath $p -Encoding UTF8 -Value $t }" >>"%LOG%" 2>&1

rem === Logos en /img para APP (raíz)
if not exist "%ROOT%img" mkdir "%ROOT%img"
if exist "%ROOT%guadiana logo.jpg" copy /y "%ROOT%guadiana logo.jpg" "%ROOT%img\guadiana.jpg" >nul
if exist "%ROOT%cumbria logo.jpg" copy /y "%ROOT%cumbria logo.jpg" "%ROOT%img\cumbria.jpg" >nul

rem === Abrir servidor y APP raíz
start "" /min cmd /c "cd /d "%ROOT%" && %PY% -m http.server 8000"
start "" "http://localhost:8000/live.mobile.html"
echo Listo. Log: %LOG%
goto :eof

:fail
echo ERROR. Revisa "%LOG%"
exit /b 1
