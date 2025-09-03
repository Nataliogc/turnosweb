# 0todo_en_un_click.ps1
# Ejecuta toda la cadena con permisos y muestra errores de forma clara.
param(
  [string]$ExcelPath = ""
)

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$log = Join-Path $PSScriptRoot "log_run.txt"
"=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Inicio ===" | Out-File -FilePath $log -Encoding UTF8

function Run-Step($title, $cmd) {
  Write-Host $title -ForegroundColor Cyan
  & cmd /c $cmd 2>&1 | Tee-Object -FilePath $log -Append
  if ($LASTEXITCODE -ne 0) {
    throw "Fallo en: $title (revisa log_run.txt)"
  }
}

try {
  if ($ExcelPath -ne "") {
    Run-Step "[1/3] Exportando turnos desde Excel (ruta forzada)" "py .\exportar_turnos_desde_excel.py `"$ExcelPath`""
  } else {
    Run-Step "[1/3] Exportando turnos desde Excel" "py .\exportar_turnos_desde_excel.py"
  }

  Run-Step "[2/3] Generando index.html" "py .\generar_index_NEW.py"
  Run-Step "[3/3] Generando live.html" "py .\generar_live.py"

  Write-Host "Abriendo resultados..." -ForegroundColor Green
  Start-Process ".\index.html"
  Start-Process ".\live.html"
  "=== $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') Fin ===" | Out-File -FilePath $log -Append
  Write-Host "OK. Log en $log" -ForegroundColor Green
} catch {
  "ERROR: $($_.Exception.Message)" | Tee-Object -FilePath $log -Append
  Write-Host "ERROR. Revisa $log" -ForegroundColor Red
  exit 1
}
