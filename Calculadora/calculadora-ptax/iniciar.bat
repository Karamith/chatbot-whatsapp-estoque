@echo off
title Import Parts Pricing
chcp 65001 >nul
echo ========================================================
echo   Iniciando o servidor local do Import Parts Pricing...
echo ========================================================
echo.
cd /d "%~dp0"

REM Detectar IP local da rede
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set "LOCAL_IP=%%a"
)
REM Remover espaco inicial
set "LOCAL_IP=%LOCAL_IP: =%"

echo.
echo --------------------------------------------------------
echo   ACESSO LOCAL:
echo   http://localhost:5176
echo.
echo   LINK COMPARTILHAVEL (rede local):
echo   http://%LOCAL_IP%:5176
echo --------------------------------------------------------
echo.
echo   Compartilhe o link acima com outros usuarios
echo   conectados na mesma rede para acessar o painel.
echo.
echo ========================================================
echo.

REM Iniciar o servidor em segundo plano e abrir o navegador apos 3 segundos
start /b cmd /c "timeout /t 3 /noq >nul && start msedge --app=http://localhost:5176"
npm run dev
pause

