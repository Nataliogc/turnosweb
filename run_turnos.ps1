# run_turnos.ps1
param([string]$Mensaje = "update: turnos y live")

# 1) Regenerar CSV desde Excel maestro
py -u ".\2generar_turnos CSV.py"

# 2) Generar index.html (usa turnos_final.html)
py -u ".\generar_index.py"

# 3) Generar live.html (ligero)
py -u ".\generar_live.py"

# 4) Publicar a GitHub
git add -A
git commit -m $Mensaje 2>$null
git push origin main
Write-Host "✔ Publicado a GitHub (branch main)."
