# ejecutar.ps1 — v6.4-lts (estable)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
try { $global:PSNativeCommandUseErrorActionPreference = $false } catch {}

# Base y config
$BASE      = if ($PSScriptRoot -and $PSScriptRoot.Trim().Length -gt 0) { $PSScriptRoot } else { $PWD.Path }
$PAGES_URL = 'https://nataliogc.github.io/turnosweb/live.html'
$LOGDIR    = Join-Path $BASE 'logs'
$LOG       = Join-Path $LOGDIR 'ejecutar.log'

Set-Location -Path $BASE
if (-not (Test-Path $LOGDIR)) { New-Item -ItemType Directory -Path $LOGDIR | Out-Null }
"==============================================="        | Out-File $LOG -Encoding utf8
"[{0}] INICIO ejecutar.ps1 (LTS)" -f (Get-Date)          | Out-File $LOG -Append -Encoding utf8
"Carpeta: $PWD"                                           | Out-File $LOG -Append -Encoding utf8
"==============================================="        | Out-File $LOG -Append -Encoding utf8
Write-Host "`n=== CG Turnos | Actualización completa (Excel -> GitHub) — LTS ==="

# Git listo
if (-not (Test-Path (Join-Path $BASE '.git'))) { throw "Esta carpeta no es un repositorio Git." }
$lock = Join-Path $BASE '.git\index.lock'
if (Test-Path $lock) { Remove-Item -Force $lock }

# Cerrar Excel si está abierto
while (Get-Process -Name EXCEL -ErrorAction SilentlyContinue) {
  Write-Host "[AVISO] Excel está abierto. Ciérralo y pulsa Enter…"
  Read-Host | Out-Null
}

# Resolver Python
function Get-Py {
  $py = Get-Command py -ErrorAction SilentlyContinue; if ($py) { return $py.Path }
  $py = Get-Command python -ErrorAction SilentlyContinue; if ($py) { return $py.Path }
  return $null
}
$PYEXE = Get-Py
if (-not $PYEXE) { throw "No se encontró 'py' ni 'python' en PATH." }

# Helper Python (silenciar warnings openpyxl)
function Run-Py([string]$script) {
  Write-Host "[PY] $script"
  & $PYEXE -W ignore $script 1>> $LOG 2>> $LOG
  if ($LASTEXITCODE -ne 0) { throw "Python devolvió código $LASTEXITCODE ($script)" }
}

# Pull por si hay cambios
Write-Host "[GIT] pull --rebase…"
git pull --rebase *>> $LOG

# 1) Excel -> CSV
Write-Host "[1/4] Exportando Excel a CSV…"
Run-Py "1_ExtraerDatosExcel.py"

# 2) CSV -> HTML
Write-Host "[2/4] Generando HTML…"
Run-Py "2_GenerarCuadranteHTML.py"
Copy-Item (Join-Path $BASE 'index.html') (Join-Path $BASE 'live.html') -Force

# 3) Logos
Write-Host "[3/4] Sincronizando logos (img/)…"
$IMG = Join-Path $BASE 'img'; if (-not (Test-Path $IMG)) { New-Item -ItemType Directory -Path $IMG | Out-Null }
if (Test-Path (Join-Path $BASE 'guadiana logo.jpg')) { Copy-Item (Join-Path $BASE 'guadiana logo.jpg') (Join-Path $IMG 'guadiana.jpg') -Force }
if (Test-Path (Join-Path $BASE 'cumbria logo.jpg'))  { Copy-Item (Join-Path $BASE 'cumbria logo.jpg')  (Join-Path $IMG 'cumbria.jpg')  -Force }

# 4) Commit + push
Write-Host "[4/4] Publicando…"
git add -A *>> $LOG
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  git commit -m "turnos(LTS): $stamp" *>> $LOG
  git push *>> $LOG
} else {
  Write-Host "[info] No hay cambios que publicar."
  "[info] No hay cambios que publicar." | Out-File $LOG -Append
}

# Abrir página
Start-Process $PAGES_URL
"-----------------------------------------------" | Out-File $LOG -Append
"[{0}] FIN OK (LTS)" -f (Get-Date)                | Out-File $LOG -Append
"-----------------------------------------------" | Out-File $LOG -Append
Write-Host "`n*** TODO OK (LTS) ***"
Write-Host "Se abrió: $PAGES_URL"
Write-Host "Log: $LOG"
