@echo off
color 0E
echo ====================================================
echo      SIMULADOR DO CHATBOT (MODO TEXTO)
echo ====================================================
echo.
echo Verificando se as bibliotecas estao instaladas...
if not exist "node_modules" (
    color 0C
    echo [ERRO] Bibliotecas nao encontradas!
    echo Por favor, rode o arquivo "instalar.bat" primeiro.
    echo.
    pause
    exit /b
)

echo Iniciando o simulador...
echo.
node src/simulador.js
pause
