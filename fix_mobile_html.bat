@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

:: ============ Config/Version ============
for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmm"') do set VER=%%I
set TS=%VER%
set LOG=logs\mobile_fix_%VER%.log
if not exist logs mkdir logs >nul 2>&1
echo [%%DATE%% %%TIME%%] START mobile fix > "%LOG%"
echo [INFO] TS=%TS% >> "%LOG%"

:: ============ Target HTML ============
set FILE=live.mobile.html
if not exist "%FILE%" (
  echo [ERROR] %FILE% no existe. >> "%LOG%"
  echo %FILE% no existe.
  exit /b 1
)

copy /y "%FILE%" "%FILE%.bak" >nul && echo [OK] Backup: %FILE%.bak >> "%LOG%"

:: ============ PowerShell patcher ============
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$f = '%FILE%';" ^
  "$html = Get-Content -Raw -Path $f;" ^
  "$hadDesktop = $html -match 'plantilla_adapter_semana\.js';" ^
  "$html = $html -replace 'plantilla_adapter_semana\.js', 'plantilla_mobile_adapter.js';" ^
  "$needsBridge = -not ($html -match 'MobileTemplate\.renderContent');" ^
  "$html = $html -replace 'data\.js\?v=\d{8}_\d{4}','data.js?v=%TS%';" ^
  "$html = $html -replace 'data\.ausencias\.js\?v=\d{8}_\d{4}','data.ausencias.js?v=%TS%';" ^
  "$html = $html -replace 'plantilla_mobile_adapter\.js\?v=\d{8}_\d{4}','plantilla_mobile_adapter.js?v=%TS%';" ^
  "$html = $html -replace 'mobile\.patch\.js\?v=\d{8}_\d{4}','mobile.patch.js?v=%TS%';" ^
  "$html = $html -replace 'mobile\.app\.js\?v=\d{8}_\d{4}','mobile.app.js?v=%TS%';" ^
  "$html = $html -replace 'styles\.css\?v=\d{8}_\d{4}','styles.css?v=%TS%';" ^
  "$html = $html -replace 'styles\.mobile\.css\?v=\d{8}_\d{4}','styles.mobile.css?v=%TS%';" ^
  "$lines = $html -split '\r?\n';" ^
  "$idx = ($lines | Select-String -Pattern '<script src="plantilla_mobile_adapter\.js' -SimpleMatch).LineNumber | Select-Object -First 1;" ^
  "if ($idx) { $insertAt = $idx } else { $insertAt = 0 }" ^
  "$bridge = @('<!-- Bridge necesario -->','<script>','  window.MobileTemplate = window.MobileTemplate || {};','  if (!window.MobileTemplate.renderContent && typeof window.renderContent === ''function'') {','    window.MobileTemplate.renderContent = window.renderContent;','  }','</script>');" ^
  "if ($needsBridge -and $insertAt -gt 0) { $pre = $lines[0..($insertAt-1)]; $post = $lines[$insertAt..($lines.Length-1)]; $lines = @($pre + $bridge + $post) }" ^
  "$html2 = ($lines -join "`r`n");" ^
  "Set-Content -NoNewline -Path $f -Value $html2;" ^
  "Write-Host ('hadDesktop=' + $hadDesktop + ' needsBridge=' + $needsBridge);"

echo Hecho. Log en %LOG%
endlocal
exit /b 0
