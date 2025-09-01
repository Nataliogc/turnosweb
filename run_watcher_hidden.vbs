Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\comun\Documents\Turnos web"
WshShell.Run "powershell -ExecutionPolicy Bypass -NoLogo -NoProfile -File .\watch_excel.ps1", 0, False
