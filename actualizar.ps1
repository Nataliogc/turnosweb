# actualizar.ps1 (versión segura)
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\comun\Documents\Turnos web'

# 1) Generar CSV (solo reescribe el diagnóstico; no toca la visual)
py -u .\generar_turnos.py

# 2) Publicar a GitHub: añadir SOLO si hay cambios
git pull --rebase

# Añadimos cambios tracked y nuevos (p.ej. sustituciones_diagnostico.csv)
git add -A

# Si no hay nada staged, no commit
git diff --cached --quiet; $hasStaged=$LASTEXITCODE
if ($hasStaged -ne 0) {
  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  $msg = 'chore: actualizacion automatica ' + $stamp
  git commit -m $msg
  git push
  Write-Host 'Cambios publicados en GitHub ' $stamp
} else {
  Write-Host 'No hay cambios. Nada que publicar.'
}

Read-Host 'Fin. Pulsa ENTER para cerrar'
