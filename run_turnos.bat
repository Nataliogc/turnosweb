@echo off
REM Lanza el pipeline completo saltando ExecutionPolicy
powershell -ExecutionPolicy Bypass -File "%~dp0run_turnos.ps1" "update: turno diario"
pause
