# publicar.ps1
$ErrorActionPreference = "Stop"
cd "C:\Users\comun\Documents\Turnos web"

# 1) Genera (solo reescribe el diagnóstico; no toca la visual)
py -u .\generar_turnos.py

# 2) Sube a GitHub SOLO si hubo cambios en index.html
git pull --rebase
git add .\index.html
git diff --cached --quiet; $hasStaged=$LASTEXITCODE
if ($hasStaged -ne 0) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  git commit -m "build: index.html ($stamp)"
  git push
  Write-Host "✅ Cambios publicados en GitHub ($stamp)"
} else {
  Write-Host "ℹ️ No hay cambios en index.html. Nada que publicar."
}

Read-Host "Fin. Pulsa ENTER para cerrar"
