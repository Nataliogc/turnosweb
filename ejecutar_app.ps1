# ejecutar_app.ps1 — Genera datos, inyecta en la APP, versiona recursos y arranca servidor (VERBOSO)
param([string]$Puerto = "8000")
$ErrorActionPreference = "Stop"
$Host.UI.RawUI.ForegroundColor = "Green"

function Write-Step($n,$msg){ Write-Host "`n====[ $n ]==== $msg" -ForegroundColor Cyan }
function Write-OK($msg){ Write-Host "  ✓ $msg" -ForegroundColor Green }
function Write-Warn($msg){ Write-Host "  [AVISO] $msg" -ForegroundColor Yellow }
function Write-Err($msg){ Write-Host "  [ERROR] $msg" -ForegroundColor Red }

# 0) RAÍZ + LOG
Set-Location -LiteralPath $PSScriptRoot
$ROOT = (Get-Location).Path
$logs = Join-Path $ROOT "logs"
if (!(Test-Path $logs)) { New-Item -ItemType Directory -Path $logs | Out-Null }
$LOG  = Join-Path $logs "app.log"
"==== INICIO $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ====" | Out-File -FilePath $LOG -Encoding UTF8

Write-Host "Proyecto: $ROOT"
Write-Host "Log:      $LOG`n"

# 1) TIMESTAMP (cache-busting)
$TS = Get-Date -Format "yyyyMMdd_HHmm"
Write-Host "[INFO] Versión recursos: $TS"
"[INFO] TS=$TS" | Out-File $LOG -Append

# 2) PYTHON
Write-Step "2/10" "Detectando Python"
$PY = $null
try { $v = & python --version 2>&1; if ($LASTEXITCODE -eq 0) { $PY = "python" } } catch {}
if (-not $PY) { try { $v = & py -3 --version 2>&1; if ($LASTEXITCODE -eq 0) { $PY = "py -3" } } catch {} }
if (-not $PY) { Write-Err "Python no encontrado en PATH"; "`nERROR: Python no encontrado" | Out-File $LOG -Append; Read-Host "Pulsa ENTER para cerrar"; exit 1 }
Write-OK "Usando: $PY ($v)"

# 3) CSV + INDEX
Write-Step "3/10" "Exportando CSV desde Excel (1_ExtraerDatosExcel.py)"
try { & $PY "1_ExtraerDatosExcel.py" *>> $LOG; Write-OK "CSV exportados (si procede)" } catch { Write-Warn "1_ExtraerDatosExcel.py devolvió aviso (continúo)" }

Write-Step "4/10" "Generando index.html (2_GenerarCuadranteHTML.py)"
& $PY "2_GenerarCuadranteHTML.py" *>> $LOG
if (!(Test-Path "index.html")) { Write-Err "No se generó index.html"; Read-Host "Pulsa ENTER para cerrar"; exit 1 }
Write-OK "index.html generado"

# 4) FULL_DATA -> data.js
Write-Step "5/10" "Extrayendo window.FULL_DATA a data.js"
$index = Get-Content -LiteralPath "index.html" -Raw
$rx = [Regex]::new('window\.FULL_DATA\s*=\s*\{(.|\n)*?\};',[System.Text.RegularExpressions.RegexOptions]::Singleline)
$mt = $rx.Match($index)
if (!$mt.Success) { Write-Err "No se encontró window.FULL_DATA en index.html"; Read-Host "Pulsa ENTER para cerrar"; exit 1 }
$dataBlock = $mt.Value
"// generado $TS`n$dataBlock" | Set-Content -LiteralPath "data.js" -Encoding UTF8
$first = (Get-Content -LiteralPath "data.js" -TotalCount 2) -join " "
Write-OK "data.js creado (inicio): $first"

# 5) Inyectar data.js y versionado en APP (live.mobile.html)
Write-Step "6/10" "Inyectando data.js y ?v=$TS en live.mobile.html"
if (!(Test-Path "live.mobile.html")) { Write-Err "Falta live.mobile.html (APP)"; Read-Host "Pulsa ENTER para cerrar"; exit 1 }
$html = Get-Content -LiteralPath "live.mobile.html" -Raw
$html = [Regex]::Replace($html, '<script\s+src\s*=\s*"data\.js[^"]*"\s*>\s*</script>', '', 'IgnoreCase')
$html = [Regex]::Replace($html, '(<!-- SI GENERAS DATOS INLINE, PÉGALOS AQUÍ -->\s*)', "`$1`r`n  <script src=""data.js?v=$TS""></script>`r`n", 'IgnoreCase')
$html = [Regex]::Replace($html, 'mobile\.patch\.js[^"]*', "mobile.patch.js?v=$TS", 'IgnoreCase')
$html = [Regex]::Replace($html, 'plantilla_adapter_semana\.js[^"]*', "plantilla_adapter_semana.js?v=$TS", 'IgnoreCase')
$html = [Regex]::Replace($html, 'styles\.mobile\.css[^"]*', "styles.mobile.css?v=$TS", 'IgnoreCase')
$html = [Regex]::Replace($html, 'styles\.css[^"]*', "styles.css?v=$TS", 'IgnoreCase')
Set-Content -LiteralPath "live.mobile.html" -Encoding UTF8 -Value $html
if ($html -notmatch "data\.js\?v=$TS") { Write-Warn "No veo data.js?v=$TS en el HTML; revisa el marcador de inserción" } else { Write-OK "Inyección OK: data.js?v=$TS" }

# 6) Service Worker: HTML + data.js siempre de red (network-first)
Write-Step "7/10" "Escribiendo service-worker.js (network-first para HTML y data.js)"
@"
const CACHE_NAME = "turnosweb-app-v$TS";
const PRECACHE = [
  "styles.css",
  "styles.mobile.css",
  "mobile.patch.js",
  "plantilla_adapter_semana.js",
  "manifest.json",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)));
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  if (url.pathname.endsWith("/live.mobile.html") || url.pathname.endsWith("/data.js")) {
    e.respondWith(
      fetch(e.request)
        .then(r => { const copy = r.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, copy)); return r; })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(r => {
        const copy = r.clone(); caches.open(CACHE_NAME).then(c => c.put(e.request, copy)); return r;
      }).catch(()=>cached);
      return cached || fetchPromise;
    })
  );
});
"@ | Set-Content -LiteralPath "service-worker.js" -Encoding UTF8
Write-OK "Service Worker listo (CACHE_NAME=turnosweb-app-v$TS)"

# 7) Logos APP en .\img\
Write-Step "8/10" "Verificando logos en .\img\"
if (!(Test-Path "img")) { New-Item -ItemType Directory -Path "img" | Out-Null }
if (Test-Path "guadiana logo.jpg") { Copy-Item "guadiana logo.jpg" "img\guadiana.jpg" -Force }
if (Test-Path "cumbria logo.jpg")  { Copy-Item "cumbria logo.jpg"  "img\cumbria.jpg"  -Force }
(Test-Path "img\guadiana.jpg") ? (Write-OK "img\guadiana.jpg") : (Write-Warn "falta img\guadiana.jpg")
(Test-Path "img\cumbria.jpg")  ? (Write-OK "img\cumbria.jpg")  : (Write-Warn "falta img\cumbria.jpg")

# 8) VERIFICACIÓN FINAL
Write-Step "9/10" "Verificación final de ficheros"
$check = @(
  "index.html","live.mobile.html","data.js","styles.css","styles.mobile.css",
  "plantilla_adapter_semana.js","mobile.patch.js","service-worker.js",
  "icons\icon-192.png","icons\icon-512.png"
)
$ok=0;$bad=0
foreach($f in $check){
  if(Test-Path $f){ Write-Host "  [OK]  $f" -ForegroundColor Green; $ok++ }
  else{ Write-Host "  [FALTA]  $f" -ForegroundColor Yellow; $bad++ }
}
Write-Host ("-"*55)
Write-Host ("Resultado: OK={0}  FALTAN={1}" -f $ok,$bad) -ForegroundColor Cyan

# 9) Servidor y abrir APP
Write-Step "10/10" "Lanzando servidor y abriendo la APP"
try {
  Start-Process -WindowStyle Hidden -FilePath powershell -ArgumentList "-NoProfile","-Command","cd `"$ROOT`"; python -m http.server $Puerto" | Out-Null
} catch {
  Start-Process -WindowStyle Hidden -FilePath python -ArgumentList "-m","http.server",$Puerto | Out-Null
}
$URL = "http://localhost:$Puerto/live.mobile.html"
Start-Process $URL
Write-OK "APP: $URL"

Write-Host "`nSi NO ves cambios:"
Write-Host "  1) F12 → Application → Service Workers → Unregister"
Write-Host "  2) Application → Clear storage → Clear site data"
Write-Host "  3) Recarga (Ctrl+F5)`n"
Write-Host "Log detallado: $LOG`n"

# Mantener ventana abierta si se ejecuta con doble clic
if ($Host.Name -match 'ConsoleHost') {
  Read-Host "Pulsa ENTER para cerrar"
}
