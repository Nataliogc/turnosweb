@echo off
pushd "%~dp0"
start "" "http://localhost:8800/index.html"
py -m http.server 8800
