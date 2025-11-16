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
rem 2b) Actualizar data.js para la versión móvil
echo [2b/5] Exportando FULL_DATA a data.js...
call :RUN_PY "3_ExportFullDataToJS.py"
if errorlevel 1 (
  >>"%LOG%" echo [ERROR] Fallo al generar data.js desde index.html
  echo [ERROR] Fallo al generar data.js.
  goto END_FAIL
)


rem 3) Logos para la web
echo [3/5] Sincronizando logos (img/)...
if not exist "img" mkdir "img" >nul
if exist "guadiana logo.jpg" copy /Y "guadiana logo.jpg" "img\guadiana.jpg" >nul
if exist "cumbria logo.jpg"  copy /Y "cumbria logo.jpg"  "img\cumbria.jpg"  >nul
rem 3b) Ajustar live.mobile.html (scripts y cache-busting)
echo [3b/5] Actualizando live.mobile.html...
call "fix_mobile_html.bat"


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
REM ====== DEPLOY A GITHUB PAGES (sube ./turnosweb) ======
REM Requisitos: tener git en PATH y el repo ya clonado (con remote 'origin').

REM 1) Asegurar archivo .nojekyll (evita problemas con rutas /assets)
echo.> "turnosweb\.nojekyll"

REM 2) Detectar git
where git >NUL 2>&1 || (
  echo [DEPLOY] No se encontro 'git' en PATH. Sube la carpeta 'turnosweb' manualmente.
  goto :deploy_end
)

REM 3) Comprobar que estamos en un repo git
git rev-parse --is-inside-work-tree >NUL 2>&1 || (
  echo [DEPLOY] Esta carpeta no es un repo git. Ejecuta una vez:
  echo          git init
  echo          git remote add origin https://github.com/TU_USUARIO/turnosweb.git
  echo          git branch -M main
  echo          y vuelve a lanzar el bat.
  goto :deploy_end
)

REM 4) Comprobar que existe 'origin'
git remote get-url origin >NUL 2>&1 || (
  echo [DEPLOY] No existe remote 'origin'. Anade tu remoto y repite:
  echo          git remote add origin https://github.com/TU_USUARIO/turnosweb.git
  goto :deploy_end
)

REM 5) Asegurar branch (main o gh-pages). Intentar main primero.
set "BRANCH=main"
git rev-parse --verify %BRANCH% >NUL 2>&1 || set "BRANCH=gh-pages"

REM 6) Add/commit/push SOLO lo de /turnosweb
git add turnosweb
git commit -m "deploy app (turnosweb) %date% %time%" >NUL 2>&1 || echo [DEPLOY] (sin cambios que commitear)
git push origin %BRANCH%
if errorlevel 1 (
  echo [DEPLOY] Fallo push a '%BRANCH%'. Intentando 'gh-pages'...
  git push origin gh-pages
)

REM 7) Sugerir URL final con cache-busting
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do (set DD=%%a&set MM=%%b&set YY=%%c)
for /f "tokens=1-2 delims=: " %%h in ('time /t') do (set HH=%%h&set MN=%%i)
set "HH=%HH: =0%"
set "TS=%YY%%MM%%DD%_%HH%%MN%"

echo [DEPLOY] Publicado. Abre (cuando GitHub Pages termine de compilar):
echo   https://TU_USUARIO.github.io/turnosweb/live.mobile.html?v=%TS%

:deploy_end
REM ====== FIN DEPLOY ======

