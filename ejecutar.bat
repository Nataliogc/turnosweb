@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

rem ====== CONFIG ======
set "PAGES_URL=https://nataliogc.github.io/turnosweb/live.html"
set "LOGDIR=logs"
set "LOG=%LOGDIR%\ejecutar.log"
rem =====================

if not exist "%LOGDIR%" mkdir "%LOGDIR%" >nul 2>&1
> "%LOG%" echo ===============================================
>>"%LOG%" echo [%date% %time%] INICIO ejecutar.bat
>>"%LOG%" echo Carpeta: %CD%
>>"%LOG%" echo ===============================================

echo(
echo === CG Turnos ^| Actualizacion completa ^(Excel -> GitHub^) ===

rem 0) Comprobaciones
if not exist ".git" (
  echo [ERROR] Esta carpeta no es un repositorio Git.>>"%LOG%"
  echo [ERROR] Esta carpeta no es un repositorio Git.
  goto END_FAIL
)

if exist ".git\index.lock" (
  echo [fix] Quitando .git\index.lock>>"%LOG%"
  del /f /q ".git\index.lock"
)

:check_excel
tasklist | findstr /I EXCEL.EXE >nul
if %ERRORLEVEL%==0 (
  echo [AVISO] Excel esta abierto. Cierralo y pulsa una tecla para continuar...
  >>"%LOG%" echo [AVISO] Esperando cierre de Excel...
  pause >nul
  goto :check_excel
)

rem 1) Exportar Excel -> CSV
echo [1/5] Exportando Excel a CSV...
call :RUN_PY "1_ExtraerDatosExcel.py"
if errorlevel 1 (
  >>"%LOG%" echo [ERROR] Fallo al exportar CSV
  echo [ERROR] Fallo al exportar CSV.
  goto END_FAIL
)

rem 2) Generar index.html (+ live.html)
echo [2/5] Generando HTML...
call :RUN_PY "2_GenerarCuadranteHTML.py"
if not exist "index.html" (
  >>"%LOG%" echo [ERROR] No se genero index.html
  echo [ERROR] No se genero index.html.
  goto END_FAIL
)
copy /Y "index.html" "live.html" >nul

rem 3) Logos para la web
echo [3/5] Sincronizando logos (img/)...
if not exist "img" mkdir "img" >nul
if exist "guadiana logo.jpg" copy /Y "guadiana logo.jpg" "img\guadiana.jpg" >nul
if exist "cumbria logo.jpg"  copy /Y "cumbria logo.jpg"  "img\cumbria.jpg"  >nul

rem 4) Commit + rebase + push
echo [4/5] Subiendo cambios...
git add -A >>"%LOG%" 2>&1
git diff --cached --quiet
if %errorlevel%==0 (
  >>"%LOG%" echo [info] No hay cambios que publicar.
  echo [info] No hay cambios que publicar.
) else (
  git commit -m "turnos: actualizacion %date% %time%" >>"%LOG%" 2>&1
  git pull --rebase >>"%LOG%" 2>&1
  git push >>"%LOG%" 2>&1
)

rem 5) Abrir pagina
echo [5/5] Abriendo GitHub Pages...
start "" "%PAGES_URL%"

echo(
echo [LISTO] Proceso completado. Log: %LOG%
pause
goto :eof

:RUN_PY
set "_script=%~1"
>>"%LOG%" echo [PY] Ejecutando %_script%
py "%_script%" >>"%LOG%" 2>&1 && exit /b 0
python "%_script%" >>"%LOG%" 2>&1 && exit /b 0
exit /b 1

:END_FAIL
>>"%LOG%" echo -----------------------------------------------
>>"%LOG%" echo [%date% %time%] FIN con ERRORES
>>"%LOG%" echo -----------------------------------------------
echo(
echo *** HUBO UN PROBLEMA ***
echo Revisa el log: %LOG%
if exist "%LOG%" start notepad "%LOG%"
pause
exit /b 1
