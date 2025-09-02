param(
  [string]$Mensaje = "update: turnos y live"
)

# 1) Regenerar CSV desde el Excel maestro
py ".\2generar_turnos CSV.py"
if ($LASTEXITCODE -ne 0) { Write-Host "Error generando CSV"; exit 1 }

# 2) Generar index.html
py ".\generar_index.py"
if ($LASTEXITCODE -ne 0) { Write-Host "Error generando index.html"; exit 1 }

# 3) Generar live.html
py ".\generar_live.py"
if ($LASTEXITCODE -ne 0) { Write-Host "Error generando live.html"; exit 1 }

# 4) Publicar a GitHub
git add -A
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
