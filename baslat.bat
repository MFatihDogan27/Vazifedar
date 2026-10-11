@echo off
chcp 65001 >nul
title Vazifedar
cd /d "%~dp0"
echo Vazifedar baslatiliyor: http://localhost:8080
echo Bu pencere acik kaldigi surece uygulama calisir.
echo.
start "" http://localhost:8080
where python >nul 2>nul && (python sunucu.py & goto :eof)
where py >nul 2>nul && (py sunucu.py & goto :eof)
where node >nul 2>nul && (node server.js & goto :eof)
echo Python ya da Node.js bulunamadi. https://www.python.org adresinden Python kurup tekrar dene.
pause
