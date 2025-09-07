@echo off
setlocal EnableExtensions
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\ejecutar.ps1"
if errorlevel 1 pause
endlocal
