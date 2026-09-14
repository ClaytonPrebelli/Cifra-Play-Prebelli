@echo off
chcp 65001 >nul
title Cifra Prebelli - Servidor Local
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Node.js nao foi encontrado no PATH.
    echo Instale em https://nodejs.org e rode de novo.
    pause
    exit /b 1
)

echo.
echo Iniciando Cifra Prebelli em http://localhost:3000
echo Abrindo o navegador em 2 segundos...
echo Aperte Ctrl+C para parar o servidor.
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
node server.js

if errorlevel 1 (
    echo.
    echo [ERRO] O servidor encerrou com erro.
    echo Verifique se a porta 3000 ja esta em uso.
)
pause