@echo off
color 0A
echo ====================================================
echo      INSTALADOR DO CHATBOT DE ESTOQUE (VERSAO NOVA)
echo ====================================================
echo.
echo Verificando se o Node.js esta instalado...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERRO] O Node.js nao foi encontrado!
    echo Por favor, instale o Node.js acessando: https://nodejs.org
    echo Baixe e instale a versao "LTS" e tente novamente.
    echo.
    pause
    exit /b
)

echo [OK] Node.js detectado!
echo.
echo Baixando e instalando as bibliotecas (isso pode demorar alguns minutos)...
call npm install

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERRO] Houve um problema ao instalar as bibliotecas.
    echo Verifique sua conexao com a internet e tente novamente.
    pause
    exit /b
)

color 0A
echo.
echo ====================================================
echo    INSTALACAO CONCLUIDA COM SUCESSO!
echo ====================================================
echo Agora voce pode clicar em "iniciar_bot.bat" para rodar o servidor.
echo.
pause
