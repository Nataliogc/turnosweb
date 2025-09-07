# ejecutar.ps1 — pipeline completo v6.5  (Excel -> CSV -> HTML -> GitHub Pages)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# ===== Config =====
$PAGES_URL = 'https://nataliogc.github.io/turnosweb/live.html'
$LOGDIR    = Join-Path $PSScriptRoot 'logs'
$LOG       = Join-Path $LOGDIR 'ejecutar.log'
# ==================

# Ir a la carpeta del script y preparar log
Set-Location -Path $PSScriptRoot
if (-not (Test-Path $LOGDIR)) { New-Item -ItemType Directory -Path $LOGDIR | Out-Null }
"==============================================="                          | Out-File $LOG -Encoding utf8
("[{0}] INICIO ejecutar.ps1" -f (Get-Date))                                | Out-File $LOG -Append -Encoding utf8
("Carpeta: {0}" -f $PWD)                                                   | Out-File $LOG -Append -Encoding utf8
"==============================================="                          | Out-File $LOG -Append -Encoding utf8
Write-Host "`n=== CG Turnos | Actualización completa (Excel -> GitHub) ==="

# 0) Comprobaciones de entorno
if (-not (Test-Path (Join-Path $PSScriptRoot '.git'))) {
  "[ERROR] Esta carpeta no es un repositorio Git." | Out-File $LOG -Append
  throw "Esta carpeta no es un repositorio Git."
}
# 0.1) Quitar candado de git si quedó
$lock = Join-Path $PSScriptRoot '.git\index.lock'
if (Test-Path $lock) { "[fix] Quitando $lock" | Out-File $LOG -Append; Remove-Item -Force $lock }

# 0.2) Asegurar que Excel está cerrado
while (Get-Process -Name EXCEL -ErrorAction SilentlyContinue) {
  Write-Host "[AVISO] Excel está abierto. Ciérralo y pulsa Enter para continuar..."
  "[AVISO] Esperando cierre de Excel..." | Out-File $LOG -Append
  Read-Host | Out-Null
}

# 0.3) Localizar Python
function Get-Py {
  $py = Get-Command py -ErrorAction SilentlyContinue
  if ($py) { return $py.Path }
  $py = Get-Command python -ErrorAction SilentlyContinue
  if ($py) { return $py.Path }
  return $null
}
$PYEXE = Get-Py
if (-not $PYEXE) {
  "[ERROR] No se encontró py/python en PATH." | Out-File $LOG -Append
  throw "No se encontró 'py' ni 'python' en PATH."
}

# 0.4) Sincronizar remoto (por si hay cambios)
Write-Host "[GIT] pull --rebase..."
git pull --rebase *>> $LOG

# 1) Exportar Excel -> CSV
Write-Host "[1/5] Exportando Excel a CSV..."
"[PY] 1_ExtraerDatosExcel.py" | Out-File $LOG -Append
& $PYEXE "1_ExtraerDatosExcel.py" *>> $LOG

# 2) Generar index.html (+ live.html) con v6.5
Write-Host "[2/5] Generando HTML..."
"[PY] 2_GenerarCuadranteHTML.py" | Out-File $LOG -Append
try {
  & $PYEXE "2_GenerarCuadranteHTML.py" *>> $LOG
} catch {
  "[WARN] Generador devolvió error. Continuo si index.html existe." | Out-File $LOG -Append
}
if (-not (Test-Path 'index.html')) {
  "[ERROR] No se generó index.html." | Out-File $LOG -Append
  throw "No se generó index.html."
}
Copy-Item 'index.html' 'live.html' -Force
'[ok] live.html creado desde index.html' | Out-File $LOG -Append

# 3) Logos web (img/)
Write-Host "[3/5] Sincronizando logos (img/)..."
if (-not (Test-Path 'img')) { New-Item -ItemType Directory -Path 'img' | Out-Null }
if (Test-Path 'guadiana logo.jpg') { Copy-Item 'guadiana logo.jpg' 'img\guadiana.jpg' -Force }
if (Test-Path 'cumbria logo.jpg')  { Copy-Item 'cumbria logo.jpg'  'img\cumbria.jpg'  -Force }
if (Test-Path 'img\guadiana.jpg') { Write-Host "   - img\guadiana.jpg OK" } else { Write-Host "   - Falta img\guadiana.jpg" }
if (Test-Path 'img\cumbria.jpg')  { Write-Host "   - img\cumbria.jpg  OK" } else { Write-Host "   - Falta img\cumbria.jpg" }

# 4) Commit + Push
Write-Host "[4/5] Preparando commit..."
git add -A *>> $LOG
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) {
  "[info] No hay cambios que publicar." | Out-File $LOG -Append
  Write-Host "[info] No hay cambios que publicar."
} else {
  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  git commit -m "turnos: actualizacion $stamp" *>> $LOG
  Write-Host "[GIT] push..."
  git push *>> $LOG
}

# 5) Abrir la página pública
Write-Host "[5/5] Abriendo GitHub Pages..."
Start-Process $PAGES_URL

"-----------------------------------------------" | Out-File $LOG -Append
("[{0}] FIN OK" -f (Get-Date)) | Out-File $LOG -Append
"-----------------------------------------------" | Out-File $LOG -Append
Write-Host ""
Write-Host "*** TODO OK ***"
Write-Host "Se abrió la página: $PAGES_URL"
Write-Host "Log: $LOG"
Read-Host "`nPulsa Enter para salir" | Out-Null
