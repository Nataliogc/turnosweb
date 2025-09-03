@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set LOG=log_run.txt
echo === %DATE% %TIME% Inicio ===> "%LOG%"

echo [1/3] Exportando turnos desde Excel...
py ".\exportar_turnos_desde_excel.py" >> "%LOG%" 2>&1 || (echo ERROR exportando & exit /b 1)

echo [2/3] Generando index.html (inyectado con DATA)...
py ".\generar_index_CLEAN.py" >> "%LOG%" 2>&1 || (echo ERROR generando index & exit /b 1)

echo [3/3] (Opcional) Generando live.html...
py ".\generar_live.py" >> "%LOG%" 2>&1

echo Abriendo index.html...
start "" ".\index.html"
echo === %DATE% %TIME% Fin ===>> "%LOG%"
echo OK. Log en "log_run.txt".
