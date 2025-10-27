@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ========== 0) RAÍZ DEL PROYECTO ==========
cd /d "%~dp0"
set "ROOT=%~dp0"
set "APP=%ROOT%turnosweb"
if not exist "%ROOT%logs" mkdir "%ROOT%logs"
set "LOG=%ROOT%logs\app.log"
echo ==== INICIO %date% %time% ==== > "%LOG%"

rem ========== 1) ELEGIR PYTHON ==========
where python >nul 2>&1 && (set "PY=python") || (where py >nul 2>&1 && (set "PY=py -3") || (echo [ERROR] No se encuentra Python en PATH & echo Instala Python 3 y vuelve a intentar.>>"%LOG%" & goto :fail))
echo Usando: %PY%>>"%LOG%"

rem ========== 2) TIMESTAMP ==========
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do (set DD=%%a&set MM=%%b&set YY=%%c)
for /f "tokens=1-2 delims=: " %%h in ('time /t') do (set HH=%%h&set MN=%%i)
set "HH=%HH: =0%"
set "TS=%YY%%MM%%DD%_%HH%%MN%"
echo TS=%TS%>>"%LOG%"

rem ========== 3) CSV E INDEX ==========
echo [1/7] Exportando CSV... | tee -a "%LOG%"
%PY% "%ROOT%1_ExtraerDatosExcel.py" >>"%LOG%" 2>&1

echo [2/7] Generando index.html... | tee -a "%LOG%"
%PY% "%ROOT%2_GenerarCuadranteHTML.py" >>"%LOG%" 2>&1
if not exist "%ROOT%index.html" (echo [ERROR] Falta index.html. Revisa el log. & goto :fail)

rem ========== 4) EXTRAER FULL_DATA -> turnosweb\data.js ==========
echo [3/7] Extrayendo FULL_DATA -> data.js | tee -a "%LOG%"
mkdir "%APP%" 2>nul

set "PS1=%TEMP%\extract_full_data.ps1"
> "%PS1%" echo $ErrorActionPreference = "Stop"
>>"%PS1%" echo $html = Get-Content -LiteralPath '%ROOT%index.html' -Raw
>>"%PS1%" echo if ($html -match 'window\.FULL_DATA\s*=\s*\{(.|\n)*?\};') { $m = $matches[0]; $out = "// generado %TS%`n" + $m; Set-Content -LiteralPath '%APP%\data.js' -Encoding UTF8 -Value $out } else { throw "No se encontro window.FULL_DATA en index.html" }

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%" >>"%LOG%" 2>&1 || (echo [ERROR] No se pudo extraer FULL_DATA. Mira logs\app.log & goto :fail)
if not exist "%APP%\data.js" (echo [ERROR] No se creo turnosweb\data.js & goto :fail)

rem ========== 5) INYECTAR <script src="data.js?v=TS"> EN live.mobile.html ==========
echo [4/7] Inyectando script en live.mobile.html | tee -a "%LOG%"
copy /y "%ROOT%live.mobile.html" "%APP%\live.mobile.html" >nul

set "PS2=%TEMP%\inject_data_js.ps1"
> "%PS2%" echo $t = Get-Content -LiteralPath '%APP%\live.mobile.html' -Raw
>>"%PS2%" echo $t = $t -replace '<script\s+src\s*=\s*"data\.js[^"]*"\s*>\s*</script>', ''
>>"%PS2%" echo $t = $t -replace '(<!-- SI GENERAS DATOS INLINE, PÉGALOS AQUÍ -->\s*)', "$1`n  <script src=`"data.js?v=%TS%`"></script>`n"
>>"%PS2%" echo Set-Content -LiteralPath '%APP%\live.mobile.html' -Encoding UTF8 -Value $t

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS2%" >>"%LOG%" 2>&1

rem ========== 6) ACTUALIZAR SERVICE WORKER ==========
echo [5/7] Versionando service-worker.js | tee -a "%LOG%"
copy /y "%ROOT%service-worker.js" "%APP%\service-worker.js" >nul

set "PS3=%TEMP%\bump_sw.ps1"
> "%PS3%" echo $t = Get-Content -LiteralPath '%APP%\service-worker.js' -Raw
>>"%PS3%" echo $t = $t -replace 'CACHE_NAME\s*=\s*"turnosweb-app-v[^"]+"', 'CACHE_NAME = "turnosweb-app-v%TS%"'
>>"%PS3%" echo Set-Content -LiteralPath '%APP%\service-worker.js' -Encoding UTF8 -Value $t

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS3%" >>"%LOG%" 2>&1

rem ========== 7) COPIAR ASSETS ==========
echo [6/7] Copiando assets | tee -a "%LOG%"
if not exist "%APP%\icons" mkdir "%APP%\icons"
copy /y "%ROOT%icons\icon-192.png" "%APP%\icons\" >nul 2>&1
copy /y "%ROOT%icons\icon-512.png" "%APP%\icons\" >nul 2>&1
copy /y "%ROOT%styles.css" "%APP%\" >nul
copy /y "%ROOT%styles.mobile.css" "%APP%\" >nul
copy /y "%ROOT%plantilla_adapter_semana.js" "%APP%\" >nul
copy /y "%ROOT%mobile.patch.js" "%APP%\" >nul
copy /y "%ROOT%manifest.json" "%APP%\" >nul

echo [6.1/7] Logos | tee -a "%LOG%"
if not exist "%APP%\img" mkdir "%APP%\img"
if exist "%ROOT%guadiana logo.jpg" copy /y "%ROOT%guadiana logo.jpg" "%APP%\img\guadiana.jpg" >nul
if exist "%ROOT%cumbria logo.jpg" copy /y "%ROOT%cumbria logo.jpg" "%APP%\img\cumbria.jpg" >nul

rem ========== 8) VERIFICACIÓN RÁPIDA ==========
echo [check] Verificando ficheros clave... | tee -a "%LOG%"
for %%F in (
  "%APP%\live.mobile.html"
  "%APP%\data.js"
  "%APP%\service-worker.js"
  "%APP%\styles.css"
  "%APP%\styles.mobile.css"
  "%APP%\plantilla_adapter_semana.js"
  "%APP%\mobile.patch.js"
  "%APP%\icons\icon-192.png"
  "%APP%\icons\icon-512.png"
  "%APP%\img\guadiana.jpg"
  "%APP%\img\cumbria.jpg"
) do (
  if exist %%F (echo  OK  %%F | tee -a "%LOG%") else (echo  FALTA  %%F | tee -a "%LOG%")
)

rem ========== 9) SERVIDOR LOCAL Y APERTURA ==========
echo [7/7] Servidor local y apertura | tee -a "%LOG%"
start "" /min cmd /c "cd /d "%ROOT%" && %PY% -m http.server 8000"
start "" "http://localhost:8000/turnosweb/live.mobile.html"
echo ==== FIN %date% %time% ==== >> "%LOG%"
echo Listo. Log: %LOG%
goto :eof

:fail
echo ==== FIN CON ERRORES %date% %time% ==== >> "%LOG%"
echo Se produjo un error. Revisa: %LOG%
exit /b 1
