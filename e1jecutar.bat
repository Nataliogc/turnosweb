@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM === 0) FIJAR RAIZ AL DIRECTORIO DEL BAT (soporta espacios) ===
cd /d "%~dp0"
set "ROOT=%~dp0"
set "APP=%ROOT%turnosweb"

REM === 1) TIMESTAMP PARA CACHE-BUSTING ===
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do (set DD=%%a&set MM=%%b&set YY=%%c)
for /f "tokens=1-2 delims=: " %%h in ('time /t') do (set HH=%%h&set MN=%%i)
set "HH=%HH: =0%"
set "TS=%YY%%MM%%DD%_%HH%%MN%"

echo [1/7] Exportando CSV desde Excel...
python "%ROOT%1_ExtraerDatosExcel.py" || echo (aviso) No se pudo ejecutar 1_ExtraerDatosExcel.py

echo [2/7] Generando index.html con datos embebidos...
python "%ROOT%2_GenerarCuadranteHTML.py" || (echo ERROR generando index.html & goto :end)

if not exist "%ROOT%index.html" (echo ERROR: falta index.html & goto :end)

echo [3/7] Extrayendo FULL_DATA de index.html -> %APP%\data.js
mkdir "%APP%" 2>nul
powershell -NoProfile -Command ^
  "$html = Get-Content -LiteralPath '%ROOT%index.html' -Raw; " ^
  "if($html -match 'window\.FULL_DATA\s*=\s*\{(.|\n)*?\};'){ " ^
  "  $m=$matches[0]; $out = '// generado %env:TS%' + [Environment]::NewLine + $m; " ^
  "  Set-Content -LiteralPath '%APP%\data.js' -Encoding UTF8 -Value $out; " ^
  "} else { Write-Error 'No se encontró window.FULL_DATA en index.html'; exit 1 }" || (echo ERROR extrayendo datos & goto :end)

echo [4/7] Inyectando <script src="data.js?v=%TS%"> en live.mobile.html (solo APP)...
copy /y "%ROOT%live.mobile.html" "%APP%\live.mobile.html" >nul
powershell -NoProfile -Command ^
  "$p='%APP%\live.mobile.html'; $t=Get-Content -LiteralPath $p -Raw; " ^
  "$t = $t -replace '<script\s+src\s*=\s*""data\.js[^""]*""\s*>\s*</script>',''; " ^
  "$t = $t -replace '(<!-- SI GENERAS DATOS INLINE, PÉGALOS AQUÍ -->\s*)', '$1`n  <script src=""data.js?v=%TS%""></script>`n'; " ^
  "Set-Content -LiteralPath $p -Encoding UTF8 $t"

echo [5/7] Actualizando version cache del Service Worker (APP)...
copy /y "%ROOT%service-worker.js" "%APP%\service-worker.js" >nul
powershell -NoProfile -Command ^
  "$p='%APP%\service-worker.js'; $t=Get-Content -LiteralPath $p -Raw; " ^
  "$t = $t -replace 'CACHE_NAME\s*=\s*""turnosweb-app-v[^""]+""','CACHE_NAME = ""turnosweb-app-v%TS%""'; " ^
  "Set-Content -LiteralPath $p -Encoding UTF8 $t"

echo [6/7] Copiando assets APP / PWA...
mkdir "%APP%\icons" 2>nul
copy /y "%ROOT%icons\icon-192.png" "%APP%\icons\" >nul 2>&1
copy /y "%ROOT%icons\icon-512.png" "%APP%\icons\" >nul 2>&1
copy /y "%ROOT%styles.css" "%APP%\" >nul
copy /y "%ROOT%styles.mobile.css" "%APP%\" >nul
copy /y "%ROOT%plantilla_adapter_semana.js" "%APP%\" >nul
copy /y "%ROOT%mobile.patch.js" "%APP%\" >nul
copy /y "%ROOT%manifest.json" "%APP%\" >nul

echo [6.1/7] Asegurando logos para APP...
mkdir "%APP%\img" 2>nul
if exist "%ROOT%guadiana logo.jpg" copy /y "%ROOT%guadiana logo.jpg" "%APP%\img\guadiana.jpg" >nul
if exist "%ROOT%cumbria logo.jpg" copy /y "%ROOT%cumbria logo.jpg" "%APP%\img\cumbria.jpg" >nul

echo [7/7] Arrancando servidor local y abriendo la APP...
start "" /min cmd /c "cd /d "%ROOT%" && python -m http.server 8000"
start "" "http://localhost:8000/turnosweb/live.mobile.html"

echo.
echo Hecho. Carpeta APP: %APP%
:end
endlocal
