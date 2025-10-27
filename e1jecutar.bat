@echo off
setlocal EnableDelayedExpansion

REM === 0) TIMESTAMP para cache-busting ===
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do (set DD=%%a&set MM=%%b&set YY=%%c)
for /f "tokens=1-2 delims=: " %%h in ('time /t') do (set HH=%%h&set MN=%%i)
set HH=%HH: =0%
set TS=%YY%%MM%%DD%_%HH%%MN%

echo [1/7] Ejecutando export desde Excel...
python "1_ExtraerDatosExcel.py" || echo (aviso) No se pudo ejecutar 1_ExtraerDatosExcel.py

echo [2/7] Generando index.html con datos embebidos...
python "2_GenerarCuadranteHTML.py" || (echo ERROR generando index.html & goto :end)

if not exist "index.html" (echo ERROR: falta index.html & goto :end)

echo [3/7] Extrayendo FULL_DATA de index.html -> turnosweb\data.js
mkdir "turnosweb" 2>nul
powershell -NoProfile -Command ^
  "$html = Get-Content 'index.html' -Raw; " ^
  "if($html -match 'window\.FULL_DATA\s*=\s*\{(.|\n)*?\};'){ " ^
  "  $m=$matches[0]; " ^
  "  $out = '// generado %env:TS%' + [Environment]::NewLine + $m; " ^
  "  Set-Content -Path 'turnosweb/data.js' -Encoding UTF8 -Value $out; " ^
  "} else { Write-Error 'No se encontró window.FULL_DATA en index.html'; exit 1 }" || (echo ERROR extrayendo datos & goto :end)

echo [4/7] Inyectando <script src="data.js?v=%TS%"> en live.mobile.html (solo APP)...
copy /y "live.mobile.html" "turnosweb\live.mobile.html" >nul
powershell -NoProfile -Command ^
  "$p='turnosweb/live.mobile.html'; $t=Get-Content $p -Raw; " ^
  "$t = $t -replace '<script\s+src\s*=\s*""data\.js[^""]*""\s*>\s*</script>',''; " ^
  "$t = $t -replace '(<!-- SI GENERAS DATOS INLINE, PÉGALOS AQUÍ -->\s*)', '$1`n  <script src=""data.js?v=%TS%""></script>`n'; " ^
  "Set-Content $p -Encoding UTF8 $t"

echo [5/7] Actualizando versión de caché del Service Worker (APP)...
copy /y "service-worker.js" "turnosweb\service-worker.js" >nul
powershell -NoProfile -Command ^
  "$p='turnosweb/service-worker.js'; $t=Get-Content $p -Raw; " ^
  "$t = $t -replace 'CACHE_NAME\s*=\s*""turnosweb-app-v[^""]+""','CACHE_NAME = ""turnosweb-app-v%TS%""'; " ^
  "Set-Content $p -Encoding UTF8 $t"

echo [6/7] Copiando assets APP / PWA...
mkdir "turnosweb\icons" 2>nul
copy /y "icons\icon-192.png" "turnosweb\icons\" >nul 2>&1
copy /y "icons\icon-512.png" "turnosweb\icons\" >nul 2>&1
copy /y "styles.css" "turnosweb\" >nul
copy /y "styles.mobile.css" "turnosweb\" >nul
copy /y "plantilla_adapter_semana.js" "turnosweb\" >nul
copy /y "mobile.patch.js" "turnosweb\" >nul
copy /y "manifest.json" "turnosweb\" >nul
copy /y "live.html" "turnosweb\" >nul

echo [6.1/7] Asegurando logos para APP...
mkdir "turnosweb\img" 2>nul
if exist "guadiana logo.jpg" copy /y "guadiana logo.jpg" "turnosweb\img\guadiana.jpg" >nul
if exist "cumbria logo.jpg" copy /y "cumbria logo.jpg" "turnosweb\img\cumbria.jpg" >nul

echo [7/7] Abriendo APP local con servidor simple (http://localhost:8000/turnosweb/live.mobile.html)...
powershell -NoProfile -Command ^
  "try{cd $PWD; Start-Process powershell -ArgumentList '-NoProfile','-Command','python -m http.server 8000' -WindowStyle Hidden}catch{}; " ^
  "Start-Process 'http://localhost:8000/turnosweb/live.mobile.html'"

echo Listo. Si no ves cambios en móvil, fuerza recarga/ reinstala la PWA.
:end
endlocal
