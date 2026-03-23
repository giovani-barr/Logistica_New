@echo off
echo ====================================
echo   Resetar Banco de Dados
echo ====================================
echo.
echo ATENCAO: Isso ira APAGAR todos os dados!
echo.
pause

cd /d "%~dp0"

echo.
echo [1/4] Ativando ambiente virtual...
call venv\Scripts\activate.bat

echo.
echo [2/4] Removendo banco de dados antigo...
if exist db.sqlite3 (
    del db.sqlite3
    echo Banco removido!
) else (
    echo Nenhum banco encontrado.
)

echo.
echo [3/4] Recriando estrutura do banco...
python manage.py migrate

echo.
echo [4/4] Criando novo superusuario...
python manage.py createsuperuser

echo.
echo ====================================
echo   Banco de dados resetado!
echo   Use iniciar.bat para rodar o servidor
echo ====================================
echo.

pause
