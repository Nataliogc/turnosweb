# actualizar.ps1 — genera el CSV **solo** en la carpeta del proyecto y publica a GitHub
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\comun\Documents\Turnos web'

# 1) Generar CSV en la carpeta del proyecto
py -u .\generar_turnos.py

# 2) Commit si hay cambios y publicar
$pending = git status --porcelain
if ($pending) {
  git add -A
  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  git commit -m ('chore: actualizacion automatica ' + $stamp)
}
git pull --rebase
git push

Read-Host 'Fin. Pulsa ENTER para cerrar'
