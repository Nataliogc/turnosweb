@echo off
setlocal ENABLEDELAYEDEXPANSION
cd /d "%~dp0"

REM ====== Mensaje de commit opcional ======
set "MSG=%*"
if "%MSG%"=="" set "MSG=update: turnos"

echo.
echo ================== INICIO RUN_TURNOS ==================
echo Carpeta: %CD%
echo Commit msg: "%MSG%"
echo =======================================================
echo.

REM ====== 1) Generar CSV desde Excel (opcional) ======
set "CSVGEN="
if exist "2generar_turnos_CSV.py" set "CSVGEN=2generar_turnos_CSV.py"
if exist "2generar_turnos CSV.py" set "CSVGEN=2generar_turnos CSV.py"

if defined CSVGEN (
  echo [1/4] Generando CSV desde Excel con "%CSVGEN%"...
  py ".\%CSVGEN%"
  if errorlevel 1 goto :err
) else (
  echo [1/4] (Opcional) No encuentro "2generar_turnos_CSV.py" ni "2generar_turnos CSV.py". Paso OMITIDO.
)

REM ====== 2) Generar index.html ======
if exist "generar_index_NEW.py" (
  echo [2/4] Generando index.html con generar_index_NEW.py...
  py ".\generar_index_NEW.py"
) else if exist "generar_index.py" (
  echo [2/4] Generando index.html con generar_index.py...
  py ".\generar_index.py"
) else (
  echo [2/4] ERROR: no encuentro "generar_index_NEW.py" ni "generar_index.py".
  goto :err
)
if errorlevel 1 goto :err

REM ====== 3) Generar live.html ======
if exist "generar_live.py" (
  echo [3/4] Generando live.html...
  py ".\generar_live.py"
  if errorlevel 1 goto :err
) else (
  echo [3/4] Aviso: no encuentro "generar_live.py"; se omite.
)

REM ====== 4) Publicar a GitHub ======
echo [4/4] Publicando a GitHub...
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "%MSG%"
  if errorlevel 1 goto :err
  git push origin main
  if errorlevel 1 goto :err
  echo ✓ Publicado: cambios nuevos enviados.
) else (
  echo (No hay cambios para commit) Haciendo push por si hay commits previos...
  git push origin main
  if errorlevel 1 goto :err
  echo ✓ Publicado: push realizado.
)

REM ====== Abrir Pages con anti-cache ======
REM Normalizamos fecha/hora para URL (sin espacios/':'/'.'/'/')
set "TS=%DATE%_%TIME%"
set "TS=%TS: =_%"
set "TS=%TS:/=-%"
set "TS=%TS:\=-%"
set "TS=%TS::=-%"
set "TS=%TS:.=-%"

start "" "https://nataliogc.github.io/turnosweb/index.html?v=%TS%"
start "" "https://nataliogc.github.io/turnosweb/live.html?v=%TS%"

echo.
echo ============== TODO OK ==============
exit /b 0

:err
echo.
echo ✗ ERROR durante la ejecución (nivel %errorlevel%).
echo Revisa el paso señalado arriba (1/4, 2/4, 3/4 o 4/4).
exit /b 1
