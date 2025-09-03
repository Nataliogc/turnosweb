@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
chcp 65001 >nul
set PYTHONIOENCODING=utf-8
set LOG=log_run.txt
echo === %DATE% %TIME% Inicio ===> "%LOG%"

echo [1/4] Exportando turnos desde Excel...
py ".\exportar_turnos_desde_excel.py" >> "%LOG%" 2>&1 || (echo ERROR exportando & exit /b 1)

echo [2/4] Generando index.html desde plantilla...
py ".\generar_index_CLEAN.py" >> "%LOG%" 2>&1 || echo AVISO: generar_index_CLEAN.py dio aviso, seguimos

echo [3/4] Generando live.html (UI completa)...
py ".\generar_live.py" >> "%LOG%" 2>&1 || (echo ERROR generando live & exit /b 1)

echo [4/4] Igualando: live -> index...
copy /y ".\live.html" ".\index.html" >nul

echo Abriendo index.html...
start "" ".\index.html"
echo === %DATE% %TIME% Fin ===>> "%LOG%"
echo OK. Log en "log_run.txt".
