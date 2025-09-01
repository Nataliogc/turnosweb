@echo off
setlocal
REM Genera index.html y publica al repo (main)
py "%~dp0generar_index.py" || goto :err
git add index.html generar_index.py run_generar_index.bat auto_update.bat README.txt
git commit -m "chore: index actualizado"
git push
echo OK. Subido a GitHub.
exit /b 0
:err
echo Error generando index.html
exit /b 1
