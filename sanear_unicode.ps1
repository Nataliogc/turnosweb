# sanear_unicode.ps1
# Reemplaza símbolos problemáticos en scripts .py para que el log quede ASCII.
param(
  [string]$PathRoot = "."
)

Set-Location -Path $PSScriptRoot

$patterns = @{
  "✓" = "OK"
  "→" = "->"
  "—" = "-"
  "–" = "-"
}

Get-ChildItem -Path $PathRoot -Filter *.py -Recurse | ForEach-Object {
  $file = $_.FullName
  $content = Get-Content -LiteralPath $file -Raw -Encoding UTF8
  $orig = $content
  foreach ($k in $patterns.Keys) {
    $content = $content -replace [Regex]::Escape($k), $patterns[$k]
  }
  if ($content -ne $orig) {
    $content | Set-Content -LiteralPath $file -Encoding UTF8
    Write-Host "Sanitizado: $file"
  }
}
Write-Host "Listo."
