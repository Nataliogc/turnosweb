@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Turnos APP · Generación e Inyección (VERBOSO)

REM ===== Raíz y log =====
cd /d "%~dp0"
set "ROOT=%~dp0"
if not exist "%ROOT%logs" mkdir "%ROOT%logs"
set "LOG=%ROOT%logs\app.log"
echo ==== INICIO %date% %time% ==== > "%LOG%"

echo.
echo ===========================================================
echo  Turnos APP · Generación e Inyección (VERBOSO)
echo  Carpeta: %ROOT%
echo  Log:     %LOG%
echo ===========================================================
echo.

REM ===== Timestamp =====
for /f "tokens=1-4 delims=/.- " %%a in ("%date%") do (set DD=%%a&set MM=%%b&set YY=%%c)
for /f "tokens=1-2 delims=:." %%h in ("%time%") do (set HH=%%h&set MN=%%i)
set "HH=%HH: =0%"
set "TS=%YY%%MM%%DD%_%HH%%MN%"
echo [INFO] Versión recursos: %TS% | tee -a "%LOG%"
echo.

REM ===== Python =====
echo [1/10] Detectando Python...
where python >nul 2>&1 && (set "PY=python") || (where py >nul 2>&1 && (set "PY=py -3") )
if not defined PY (
  echo [ERROR] Python no encontrado en PATH. >>"%LOG%"
  echo [ERROR] Python no encontrado en PATH. Instala Python 3 y vuelve a ejecutar.
  goto :FAIL
)
echo        Usando: %PY%
echo.

REM ===== 1) CSV =====
echo [2/10] Exportando CSV (1_ExtraerDatosExcel.py)...
%PY% "%ROOT%1_ExtraerDatosExcel.py" >>"%LOG%" 2>&1
if errorlevel 1 (echo       AVISO: 1_ExtraerDatosExcel.py devolvió código <>0 (continúo).)

REM ===== 2) index.html =====
echo [3/10] Generando index.html (2_GenerarCuadranteHTML.py)...
%PY% "%ROOT%2_GenerarCuadranteHTML.py" >>"%LOG%" 2>&1
if not exist "%ROOT%index.html" (
  echo [ERROR] Falta index.html (¿falló 2_GenerarCuadranteHTML.py?). Revisa el log.
  goto :FAIL
)
echo        index.html generado ✓
echo.

REM ===== 3) FULL_DATA -> data.js =====
echo [4/10] Extrayendo window.FULL_DATA a data.js...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$h=Get-Content -LiteralPath '%ROOT%index.html' -Raw; " ^
  "if($h -match 'window\.FULL_DATA\s*=\s*\{(.|\n)*?\};'){ $m=$matches[0]; $out='// generado %env:TS%' + [Environment]::NewLine + $m; Set-Content -LiteralPath '%ROOT%data.js' -Encoding UTF8 -Value $out } else { throw 'No se encontro window.FULL_DATA en index.html' }" >>"%LOG%" 2>&1
if errorlevel 1 (
  echo [ERROR] No se pudo extraer FULL_DATA a data.js (mira el log).
  goto :FAIL
)
for /f "usebackq tokens=* delims=" %%L in ("%ROOT%data.js") do (set "FIRST=%%L" & goto :peek)
:peek
echo        1ª línea de data.js: !FIRST!
echo.

REM ===== 4) Inyectar data.js + versionado en APP =====
echo [5/10] Inyectando data.js y ?v=%TS% en live.mobile.html...
if not exist "%ROOT%live.mobile.html" (
  echo [ERROR] Falta live.mobile.html (APP).
  goto :FAIL
)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p='%ROOT%live.mobile.html'; $t=Get-Content -LiteralPath $p -Raw; " ^
  "$t = $t -replace '<script\s+src\s*=\s*""data\.js[^""]*""\s*>\s*</script>',''; " ^
  "$t = $t -replace '(<!-- SI GENERAS DATOS INLINE, PÉGALOS AQUÍ -->\s*)','`$1`n  <script src=""data.js?v=%env:TS%""></script>`n'; " ^
  "$t = $t -replace 'mobile\.patch\.js[^""]*', 'mobile.patch.js?v=%env:TS%'; " ^
  "$t = $t -replace 'plantilla_adapter_semana\.js[^""]*', 'plantilla_adapter_semana.js?v=%env:TS%'; " ^
  "$t = $t -replace 'styles\.mobile\.css[^""]*', 'styles.mobile.css?v=%env:TS%'; " ^
  "$t = $t -replace 'styles\.css[^""]*', 'styles.css?v=%env:TS%'; " ^
  "Set-Content -LiteralPath $p -Encoding UTF8 -Value $t" >>"%LOG%" 2>&1
findstr /i "data.js?v=%TS%" "%ROOT%live.mobile.html" >nul && (echo        ✓ data.js versionado) || (echo        AVISO: no vi data.js?v=%TS% en el HTML)
echo.

REM ===== 5) Service Worker robusto =====
echo [6/10] Escribiendo Service Worker (network-first para HTML y data.js)...
> "%ROOT%service-worker.js" (
  echo // SW: HTML y data.js => network-first; resto => stale-while-revalidate
  echo const CACHE_NAME = "turnosweb-app-v%TS%";
  echo const PRECACHE = [
  echo   "styles.css",
  echo   "styles.mobile.css",
  echo   "mobile.patch.js",
  echo   "plantilla_adapter_semana.js",
  echo   "manifest.json",
  echo   "icons/icon-192.png",
  echo   "icons/icon-512.png"
  echo ];
  echo self.addEventListener("install", e => {
  echo   self.skipWaiting();
  echo   e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)));
  echo });
  echo self.addEventListener("activate", e => {
  echo   e.waitUntil((async () => {
  echo     const keys = await caches.keys();
  echo     await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
  echo     await self.clients.claim();
  echo   })());
  echo });
  echo self.addEventListener("fetch", e => {
  echo   const url = new URL(e.request.url);
  echo   if (url.origin !== location.origin) {
  echo     e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  echo     return;
  echo   }
  echo   if (url.pathname.endsWith("/live.mobile.html") ^|^| url.pathname.endsWith("/data.js")) {
  echo     e.respondWith(
  echo       fetch(e.request)
  echo         .then(r => { const copy = r.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, copy)); return r; })
  echo         .catch(() => caches.match(e.request))
  echo     );
  echo     return;
  echo   }
  echo   e.respondWith(
  echo     caches.match(e.request).then(cached => {
  echo       const fetchPromise = fetch(e.request).then(r => {
  echo         const copy = r.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, copy)); return r;
  echo       }).catch(()=>cached);
  echo       return cached ^|^| fetchPromise;
  echo     })
  echo   );
  echo });
)
echo        Service Worker listo (CACHE_NAME=turnosweb-app-v%TS%)
echo.

REM ===== 6) Logos =====
echo [7/10] Verificando logos en .\img\
if not exist "%ROOT%img" mkdir "%ROOT%img"
if exist "%ROOT%guadiana logo.jpg" copy /y "%ROOT%guadiana logo.jpg" "%ROOT%img\guadiana.jpg" >nul
if exist "%ROOT%cumbria logo.jpg"  copy /y "%ROOT%cumbria logo.jpg"  "%ROOT%img\cumbria.jpg"  >nul
if exist "%ROOT%img\guadiana.jpg" (echo        ✓ img\guadiana.jpg) else (echo        AVISO: falta img\guadiana.jpg)
if exist "%ROOT%img\cumbria.jpg"  (echo        ✓ img\cumbria.jpg)  else (echo        AVISO: falta img\cumbria.jpg)
echo.

REM ===== 7) Verificación final =====
echo [8/10] Verificación final (OK/FALTA):
for %%F in (
  "%ROOT%index.html"
  "%ROOT%live.mobile.html"
  "%ROOT%data.js"
  "%ROOT%styles.css"
  "%ROOT%styles.mobile.css"
  "%ROOT%plantilla_adapter_semana.js"
  "%ROOT%mobile.patch.js"
  "%ROOT%service-worker.js"
  "%ROOT%icons\icon-192.png"
  "%ROOT%icons\icon-512.png"
) do (
  if exist %%F (echo   [OK] %%F) else (echo   [FALTA] %%F)
)
echo.

REM ===== 8) Servidor y abrir =====
echo [9/10] Lanzando servidor local...
start "" /min cmd /c "cd /d "%ROOT%" && %PY% -m http.server 8000"

echo [10/10] Abriendo APP: http://localhost:8000/live.mobile.html
start "" "http://localhost:8000/live.mobile.html"

echo.
echo === SI NO VES CAMBIOS ===
echo  1) F12 ^> Application ^> Service Workers: Unregister
echo  2) Application ^> Clear storage: Clear site data
echo  3) Recarga (Ctrl+F5)
echo.
echo Abriendo el log en el Bloc de notas...
start "" notepad "%LOG%"

echo.
echo ==== FIN (la ventana quedará ABIERTA) ====
echo.
pause
goto :EOF

:FAIL
echo.
echo *** ERROR. Se detuvo la ejecución. Abriendo el log...
start "" notepad "%LOG%"
echo (Cierra el Bloc de notas para volver aquí)
pause
exit /b 1
