@echo off
setlocal
py "%~dp0generar_index.py" || goto :err
pushd "%~dp0"
start "" "http://localhost:8800/index.html"
py -m http.server 8800
exit /b 0
:err
echo Hubo un error. Revisa el mensaje de arriba.
pause
exit /b 1
