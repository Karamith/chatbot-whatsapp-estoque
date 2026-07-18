@echo off
color 0B
echo ====================================================
echo      INICIANDO O SERVIDOR DO CHATBOT DE ESTOQUE
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

echo Iniciando o sistema...
echo Pressione Ctrl+C e confirme com "S" ou feche a janela para desligar.
echo.
node src/index.js
pause
