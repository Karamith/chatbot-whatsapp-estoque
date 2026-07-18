@echo off
color 0A
echo ====================================================
echo      CRIANDO PLANILHA DE ESTOQUE (EXEMPLO)
echo ====================================================
echo.
if not exist "node_modules" (
    color 0C
    echo [ERRO] Bibliotecas nao encontradas!
    echo Por favor, rode o arquivo "instalar.bat" primeiro.
    echo.
    pause
    exit /b
)

node gerar_planilha.js
echo.
pause
