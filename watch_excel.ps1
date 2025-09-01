# Vigila el Excel y regenera index.html al guardarlo.
$script:excel = "C:\Users\comun\OneDrive\02. Comp. Min Recepción\3. Turnos\Plantilla Cuadrante con Sustituciones v.6.0.xlsx"
$script:proj  = "C:\Users\comun\Documents\Turnos web"

$dir = Split-Path $script:excel
$fn  = Split-Path $script:excel -Leaf

# FileSystemWatcher
$fsw = New-Object System.IO.FileSystemWatcher
$fsw.Path                  = $dir
$fsw.Filter                = $fn
$fsw.IncludeSubdirectories = $false
$fsw.EnableRaisingEvents   = $true
$fsw.NotifyFilter          = [IO.NotifyFilters]'LastWrite,FileName,Size'

# Acción al cambiar/crear/renombrar
$action = {
  try {
    Start-Sleep -Milliseconds 1200   # debounce por OneDrive/Excel
    Start-Process -FilePath "py" -ArgumentList "generar_index.py" -WorkingDirectory $script:proj -NoNewWindow -Wait
    Write-Host ("Regenerado index.html  " + (Get-Date).ToString("HH:mm:ss"))
  } catch {
    Write-Warning $_
  }
}

# Suscripciones
Register-ObjectEvent -InputObject $fsw -EventName Changed -SourceIdentifier "TW-Excel-Changed" -Action $action | Out-Null
Register-ObjectEvent -InputObject $fsw -EventName Created -SourceIdentifier "TW-Excel-Created" -Action $action | Out-Null
Register-ObjectEvent -InputObject $fsw -EventName Renamed -SourceIdentifier "TW-Excel-Renamed" -Action $action | Out-Null

Write-Host "Vigilando: $script:excel  (Ctrl+C para salir)"
while ($true) { Start-Sleep 2 }
