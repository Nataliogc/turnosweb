@echo off
setlocal
py "%~dp0generar_index.py"
if errorlevel 1 (
  echo Hubo un error. Revisa el mensaje de arriba.
  pause
  exit /b 1
)
pushd "%~dp0"
start "" "http://localhost:8800/index.html"
py -m http.server 8800
