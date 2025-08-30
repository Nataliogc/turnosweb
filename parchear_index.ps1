# Inserta el script del parche antes de </body> en .\index.html (si no está ya)
$ErrorActionPreference = 'Stop'
$path = ".\index.html"
if (-not (Test-Path $path)) { throw "No existe $path en esta carpeta." }
$content = Get-Content $path -Raw
if ($content -notmatch 'vacaciones_noches_patch_v2.js') {
  $nuevo = $content -replace '</body>', '  <script src="./vacaciones_noches_patch_v2.js" defer></script>`r`n</body>'
  $nuevo | Set-Content -Encoding UTF8 $path
  Write-Host "✅ Parche insertado en index.html"
} else {
  Write-Host "ℹ️ El parche ya estaba incluido en index.html"
}
pause
