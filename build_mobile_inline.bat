@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

:: Genera live.mobile.inline.html con FULL_DATA sacado de live.html
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmm"') do set VER=%%I
set OUT=live.mobile.inline.html

if not exist live.html (
  echo [ERROR] live.html no existe.
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$live = Get-Content -Raw -Path 'live.html';" ^
  "$m = [regex]::Match($live, 'window\.FULL_DATA\s*=\s*(\{[\s\S]+?\});');" ^
  "if(!$m.Success){ Write-Error 'No se encontró window.FULL_DATA en live.html'; exit 1 }" ^
  "$json = $m.Groups[1].Value;" ^
  "$html = @' ^
<!doctype html>^
<html lang="es">^
<head>^
  <meta charset="utf-8" />^
  <meta name="viewport" content="width=device-width, initial-scale=1" />^
  <title>Cuadrantes de turnos · Móvil (INLINE)</title>^
  <link rel="icon" href="img/turnos_icon.png" />^
  <link rel="stylesheet" href="styles.css?v=TS" />^
  <link rel="stylesheet" href="styles.mobile.css?v=TS" />^
</head>^
<body>^
  <header class="app-header">^
    <div class="brand">^
      <img src="img/turnos_icon.png" alt="" style="width:24px;height:24px;border-radius:6px">^
      <div class="title">Cuadrantes de turnos</div>^
    </div>^
    <div class="actions">^
      <button id="btnPrev" class="btn">← Semana</button>^
      <button id="btnToday" class="btn">Hoy</button>^
      <button id="btnNext" class="btn">Semana →</button>^
      <button id="btnFilters" class="btn primary">Filtros</button>^
    </div>^
  </header>^
  <main class="wrap"><div id="monthly-summary-container"></div></main>^
  <script>window.FULL_DATA = JSON.parse(decodeURIComponent('%JSON%'));</script>^
  <script src="plantilla_mobile_adapter.js?v=TS"></script>^
  <script>window.MobileTemplate=window.MobileTemplate||{};if(!window.MobileTemplate.renderContent&&typeof window.renderContent==='function'){window.MobileTemplate.renderContent=window.renderContent;}</script>^
  <script src="mobile.patch.js?v=TS"></script>^
  <script src="mobile.app.js?v=TS"></script>^
</body>^
</html>^
'@;" ^
  "$enc = [uri]::EscapeDataString($json);" ^
  "$out = $html.Replace('%JSON%', $enc);" ^
  "Set-Content -NoNewline -Path '%OUT%' -Value $out;"

if errorlevel 1 (
  echo [ERROR] No se pudo generar %OUT%
  exit /b 1
)

echo OK. Abre %OUT%
endlocal
exit /b 0
