@echo off
echo ==============================
echo   Turnos Web - Generar y subir
echo ==============================
echo.

REM 1) Generar CSV desde Excel
py 2generar_turnos_CSV.py
if errorlevel 1 (
  echo Error al generar CSV
  pause
  exit /b 1
)

REM 2) Generar index.html
py generar_index.py
if errorlevel 1 (
  echo Error al generar index.html
  pause
  exit /b 1
)

REM 3) Generar live.html
py generar_live.py
if errorlevel 1 (
  echo Error al generar live.html
  pause
  exit /b 1
)

REM 4) Commit y push a GitHub
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "update: turno diario"
  git push origin main
  echo Publicado: cambios nuevos enviados.
) else (
  echo No hay cambios para commit. Se hace push igualmente.
  git push origin main
  echo Publicado: push realizado.
)

echo.
echo ======= FIN CORRECTO =======
pause
