@echo off
REM Arranca el vigilante que regenera/sube el index al guardar el Excel
set "PROJ=C:\Users\comun\Documents\Turnos web"
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

pushd "%PROJ%"
"%PS%" -ExecutionPolicy Bypass -NoLogo -NoProfile -File ".\watch_excel.ps1"
popd
