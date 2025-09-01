@echo off
REM Ejecuta ambos generadores con el Python por defecto (py launcher)
echo === Generando index.html ===
py generar_index.py
echo.
echo === Generando live.html ===
py generar_live.py
echo.
echo Listo.
pause