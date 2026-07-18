@echo off
echo =======================================================
echo AVISO: Voce esta prestes a ZERAR a base de dados do bot!
echo Isso apagara o historico de sessoes, consultas e pedidos.
echo As tabelas mestre (JIGs, Tecnicos, etc) serao mantidas.
echo =======================================================
echo.
pause
echo.
echo Executando a limpeza...
node scripts/reset_db.js
echo.
pause
