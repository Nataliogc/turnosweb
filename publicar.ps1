param(
  [string]$Mensaje = "update: turnos"
)

# Añadir cambios
git add -A

# Si hay cambios en staging, comitea; si no, solo push
git diff --cached --quiet
if ($LASTEXITCODE -eq 1) {
  git commit -m $Mensaje
  if ($LASTEXITCODE -ne 0) {
    Write-Host "No se pudo hacer commit. Revisa el estado del repo."
    exit 1
  }
  git push origin main
  Write-Host "Publicado: cambios nuevos enviados."
} else {
  Write-Host "No hay cambios para commit. Se hace push igualmente por si hay commits previos."
  git push origin main
  Write-Host "Publicado: push realizado."
}
