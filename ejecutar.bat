@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

rem ====== CONFIG MINIMA ======
set "PAGES_URL=https://nataliogc.github.io/turnosweb/live.html"
set "LOGDIR=logs"
set "LOG=%LOGDIR%\ejecutar.log"
rem ===========================

if not exist "%LOGDIR%" mkdir "%LOGDIR%" >nul 2>&1
echo =============================================== > "%LOG%"
echo [%date% %time%] INICIO ejecutar.bat            >> "%LOG%"
echo Carpeta: %CD%                                   >> "%LOG%"
echo =============================================== >> "%LOG%"

echo.
echo === CG Turnos | Actualizacion completa (Excel -> GitHub) ===

rem -- 0) Comprobaciones
if not exist ".git" (
  echo [ERROR] Esta carpeta no es un repositorio Git. >> "%LOG%"
  echo [ERROR] Esta carpeta no es un repositorio Git.
  pause & exit /b 1
)

rem -- 0.1) Quitar candado de git
if exist ".git\index.lock" (
  echo [fix] Quitando .git\index.lock                >> "%LOG%"
  del /f /q ".git\index.lock"
)

rem -- 0.2) Asegurar que Excel esta cerrado
:check_excel
tasklist | findstr /I EXCEL.EXE >nul
if %ERRORLEVEL%==0 (
  echo [AVISO] Excel esta abierto. Cierralo para continuar...
  echo [AVISO] Esperando cierre de Excel...          >> "%LOG%"
  pause >nul
  goto :check_excel
)

rem -- 0.3) Comprobar Python disponible
where py >nul 2>&1
if errorlevel 1 (
  where python >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] No se encontro 'py' ni 'python' en PATH. >> "%LOG%"
    echo [ERROR] No se encontro 'py' ni 'python' en PATH.
    echo Instala Python o agrega 'py'/'python' al PATH y reintenta.
    pause & exit /b 1
  )
)

rem -- 0.4) Sincronizar desde remoto (por si hay cambios)
echo [GIT] pull --rebase...
git pull --rebase >> "%LOG%" 2>&1

rem -- 1) Exportar Excel -> CSV
echo [1/5] Exportando Excel a CSV...
call :RUN_PY "1_ExtraerDatosExcel.py"
if errorlevel 1 (
  echo [ERROR] Fallo al exportar CSV.                 >> "%LOG%"
  echo [ERROR] Fallo al exportar CSV (revisa que el Excel exista y este cerrado).
  goto :END_FAIL
)

rem -- 2) Generar index.html (+ live.html)
echo [2/5] Generando HTML...
call :RUN_PY "2_GenerarCuadranteHTML.py"
if errorlevel 1 (
  echo [WARN] El generador devolvio error, continuo si existe index.html >> "%LOG%"
)
if not exist "index.html" (
  echo [ERROR] No se genero index.html.               >> "%LOG%"
  echo [ERROR] No se genero index.html.
  goto :END_FAIL
)
if not exist "live.html" (
  copy /Y "index.html" "live.html" >nul
  echo [ok] live.html creado desde index.html         >> "%LOG%"
)

rem -- 3) Logos para web
echo [3/5] Sincronizando logos (img/)...
if not exist "img" mkdir "img" >nul
if exist "guadiana logo.jpg" copy /Y "guadiana logo.jpg" "img\guadiana.jpg" >nul
if exist "cumbria logo.jpg"  copy /Y "cumbria logo.jpg"  "img\cumbria.jpg"  >nul
if exist "img\guadiana.jpg" (echo     img\guadiana.jpg OK) else (echo     Falta img\guadiana.jpg)
if exist "img\cumbria.jpg"  (echo     img\cumbria.jpg  OK) else (echo     Falta img\cumbria.jpg)

rem -- 4) Commit + Push
echo [4/5] Preparando commit...
git add -A >> "%LOG%" 2>&1

rem Si no hay nada staged, saltar commit
git diff --cached --quiet
if %errorlevel%==0 (
  echo [info] No hay cambios que publicar.            >> "%LOG%"
  echo [info] No hay cambios que publicar.
) else (
  git commit -m "turnos: actualizacion %date% %time%" >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo [WARN] Commit dio advertencia, continuo...    >> "%LOG%"
  )
  echo [GIT] push...
  git push >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo [ERROR] git push fallo.                       >> "%LOG%"
    echo [ERROR] git push fallo (revisa credenciales o conexion).
    goto :END_FAIL
  )
)

rem -- 5) Abrir pagina publica
echo [5/5] Abriendo GitHub Pages...
start "" "%PAGES_URL%"

echo.
echo [LISTO] Proceso completado. Log: %LOG%
echo (si algo no se ve, abre el log o pulsa una tecla para verlo aqui)
choice /C QV /N /M "Pulsa V para ver el log, Q para salir: "
if errorlevel 2 (
  notepad "%LOG%"
)
goto :END_OK

:RUN_PY
set "_script=%~1"
echo [PY] Ejecutando %_script%                        >> "%LOG%"
py "%_script%" >> "%LOG%" 2>&1 && exit /b 0
python "%_script%" >> "%LOG%" 2>&1 && exit /b 0
exit /b 1

:END_FAIL
echo -----------------------------------------------  >> "%LOG%"
echo [%date% %time%] FIN con ERRORES                  >> "%LOG%"
echo -----------------------------------------------  >> "%LOG%"
echo.
echo Revisa el LOG: %LOG%
pause
exit /b 1

:END_OK
echo -----------------------------------------------  >> "%LOG%"
echo [%date% %time%] FIN OK                           >> "%LOG%"
echo -----------------------------------------------  >> "%LOG%"
exit /b 0
