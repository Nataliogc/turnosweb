@echo off
setlocal ENABLEDELAYEDEXPANSION
REM === Ejecutar siempre desde la carpeta del script ===
cd /d "%~dp0"

echo ==============================
echo   Turnos Web - Generar y subir
echo ==============================
echo.

REM 0) Comprobaciones basicas
where py >nul 2>nul || (echo No se encontro Python ^(py^). Instala Python o agrega al PATH.& pause & exit /b 1)
where git >nul 2>nul || (echo No se encontro Git. Instala Git o agrega al PATH.& pause & exit /b 1)

REM 1) Generar CSV desde Excel
echo [1/4] Generando CSV de sustituciones...
py 2generar_turnos_CSV.py
if errorlevel 1 (
  echo ERROR: Fallo generando CSV.
  pause
  exit /b 1
)

REM 2) Generar index.html
echo [2/4] Generando index.html...
py generar_index.py
if errorlevel 1 (
  echo ERROR: Fallo generando index.html.
  pause
  exit /b 1
)

REM 3) Generar live.html
echo [3/4] Generando live.html...
py generar_live.py
if errorlevel 1 (
  echo ERROR: Fallo generando live.html.
  pause
  exit /b 1
)

REM 4) Commit y push a GitHub (branch main)
echo [4/4] Publicando en GitHub...
git add -A

git diff --cached --quiet
if %ERRORLEVEL%==1 (
  git commit -m "update: turno diario"
  if errorlevel 1 (
    echo ERROR: No se pudo hacer commit. Revisa el estado del repo.
    pause
    exit /b 1
  )
  git push origin main
  if errorlevel 1 (
    echo ERROR: No se pudo hacer push. Comprueba la conexion o permisos.
    pause
    exit /b 1
  )
  echo Publicado: cambios nuevos enviados.
) else (
  echo No hay cambios para commit. Se hace push igualmente...
  git push origin main
  if errorlevel 1 (
    echo ERROR: No se pudo hacer push. Comprueba la conexion o permisos.
    pause
    exit /b 1
  )
  echo Publicado: push realizado.
)

echo.
echo ======= FIN CORRECTO =======
pause
endlocal
