@echo off
color 0A
echo ====================================================
echo      INICIANDO O BOT NO AMBIENTE REAL (WHATSAPP)
echo ====================================================
echo.
echo Verificando dependencias...
if not exist "node_modules" (
    color 0C
    echo [ERRO] Bibliotecas nao encontradas!
    echo Rode o comando npm install antes de continuar.
    pause
    exit /b
)

echo DICA: Escaneie o QR Code que aparecera na tela (caso nao esteja logado).
echo O Bot respondera a mensagens reais do WhatsApp e enviara E-mails para o Backoffice.
echo.
echo Pressione Ctrl+C para desligar o Bot.
echo.
set NODE_ENV=production
node src/index.js
pause
