@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo ========================================================
echo  Turnos Web - Pipeline movil (sin tocar index)
echo ========================================================
echo.

:: 1) Ejecutar tu pipeline si existe (no obligatorio)
set _PIPE_OK=0
if exist "ejecutar_app.ps1" (
  echo [1/5] Ejecutando PowerShell ejecutar_app.ps1 ...
  powershell -NoProfile -ExecutionPolicy Bypass -File ".\ejecutar_app.ps1"
  if %ERRORLEVEL%==0 set _PIPE_OK=1
) else if exist "ejecutar_app.bat" (
  echo [1/5] Ejecutando ejecutar_app.bat ...
  call ".\ejecutar_app.bat"
  if %ERRORLEVEL%==0 set _PIPE_OK=1
) else if exist "ejecutar_app_verbose.bat" (
  echo [1/5] Ejecutando ejecutar_app_verbose.bat ...
  call ".\ejecutar_app_verbose.bat"
  if %ERRORLEVEL%==0 set _PIPE_OK=1
) else (
  echo [1/5] No hay scripts de pipeline. Continuo con modo fallback.
)

echo.
:: 2) Si hay DATA_preview.json, construir data.js compatible con index/live y live.mobile
if exist "DATA_preview.json" (
  echo [2/5] Generando data.js desde DATA_preview.json ...
  rem Backup por seguridad
  if exist "data.js" copy /y "data.js" "logs\data.backup.%DATE:/=-%_%TIME::=-%.js" >nul 2>&1

  powershell -NoProfile -ExecutionPolicy Bypass ^
    -Command ^
    "$ErrorActionPreference='Stop';" ^
    "if(-not (Test-Path 'DATA_preview.json')){throw 'No existe DATA_preview.json'};" ^
    "$raw=Get-Content 'DATA_preview.json' -Raw | ConvertFrom-Json;" ^
    "$rows=@(); if($raw.rows){$rows=$raw.rows} elseif($raw.data){$rows=$raw.data} else {$rows=@()};" ^
    "function Get-Monday([datetime]$d){$dw=[int]$d.DayOfWeek; $off=(($dw+6)%%7); return $d.AddDays(-$off).ToString('yyyy-MM-dd') };" ^
    "$parsed=@(); foreach($r in $rows){" ^
    "  $hotel   = $r.hotel, $r.Hotel, $r.establecimiento, $r.Establecimiento, $r.meta.hotel | Where-Object {$_} | Select-Object -First 1;" ^
    "  $empleado= $r.empleado, $r.employee, $r.nombre, $r.name, $r.persona | Where-Object {$_} | Select-Object -First 1;" ^
    "  $fecha   = $r.fecha, $r.Fecha, $r.date, $r.day, $r.dia | Where-Object {$_} | Select-Object -First 1;" ^
    "  $turno   = $r.turno, $r.Turno, $r.shift, $r.tramo | Where-Object {$_} | Select-Object -First 1;" ^
    "  if($hotel -and $empleado -and $fecha){" ^
    "    try{$df=[datetime]$fecha}catch{$df=[datetime]::ParseExact($fecha,'yyyy-MM-dd',$null)};" ^
    "    $parsed += [pscustomobject]@{hotel=$hotel;empleado=$empleado;fecha=$df.ToString('yyyy-MM-dd');turno=$turno}" ^
    "  }" ^
    "};" ^
    "$groups = $parsed | Group-Object hotel, @{Name='semana_lunes';Expression={ Get-Monday([datetime]$_.fecha) }};" ^
    "$schedule = @();" ^
    "foreach($g in $groups){" ^
    "  $hotel=$g.Group[0].hotel; $sem=$g.Group[0].semana_lunes;" ^
    "  $orden=[System.Collections.Generic.List[string]]::new();" ^
    "  $turnos=@();" ^
    "  foreach($x in $g.Group){" ^
    "    if(-not $orden.Contains($x.empleado)){ $orden.Add($x.empleado) }" ^
    "    $turnos += [pscustomobject]@{empleado=$x.empleado;fecha=$x.fecha;turno=$x.turno}" ^
    "  }" ^
    "  $schedule += [pscustomobject]@{hotel=$hotel;semana_lunes=$sem;orden_empleados=$orden;turnos=$turnos}" ^
    "};" ^
    "$out = @{ schedule = $schedule; data = $parsed } | ConvertTo-Json -Depth 6;" ^
    "$bridge = @'`n/* ===== Compatibilidad APP MOVIL ===== */`n(function(){try{window.FULL_DATA=window.FULL_DATA||window.DATA||DATA||{}; if(!window.DATA&&window.FULL_DATA){window.DATA=window.FULL_DATA;} }catch(e){}})();`n'@;" ^
    "$prefix = 'window.DATA = ';" ^
    "Set-Content -LiteralPath 'data.js' -Value ($prefix + $out + ';' + $bridge) -Encoding UTF8;"

  if %ERRORLEVEL%==0 (
    echo [3/5] data.js generado correctamente.
  ) else (
    echo [3/5] No se pudo generar data.js. Reviso existencia actual...
  )
) else (
  echo [2/5] No existe DATA_preview.json. Mantengo data.js actual.
)

echo.
:: 3) Forzar actualización de Service Worker (tocar timestamp)
if exist "service-worker.js" (
  echo // touch %DATE% %TIME%>> "service-worker.js"
  echo [4/5] SW actualizado para refrescar cache.
) else (
  echo [4/5] No hay service-worker.js (ok).
)

echo.
:: 4) Abrir SOLO la app movil
echo [5/5] Abriendo live.mobile.html ...
start "" "live.mobile.html"

echo.
echo Hecho. Si ves "registros: 0" en consola, revisa que DATA_preview.json tenga filas.
exit /b 0
