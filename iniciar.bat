@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
echo ====================================
echo   Fermap Logistica - Iniciando
echo ====================================
echo.

cd /d "%~dp0"
set "PROJECT_DIR=%CD%"

echo [1/4] Detectando ambiente virtual...
if exist .venv\Scripts\python.exe (
    set "VENV_DIR=.venv"
) else if exist venv\Scripts\python.exe (
    set "VENV_DIR=venv"
) else (
    echo ERRO: Ambiente virtual nao encontrado!
    echo Rode setup_completo.bat para configurar o projeto.
    echo.
    pause
    exit /b 1
)

echo Ambiente selecionado: %VENV_DIR%
echo.
pause

call :run_step "Validar Django com manage.py check" "%PROJECT_DIR%\%VENV_DIR%\Scripts\python.exe %PROJECT_DIR%\manage.py check --verbosity 0"
call :run_step "Aplicar migracoes pendentes" "%PROJECT_DIR%\%VENV_DIR%\Scripts\python.exe %PROJECT_DIR%\manage.py migrate --noinput"

echo.
echo ====================================
echo   O servidor sera iniciado agora.
echo   Acesse: http://127.0.0.1:8000
echo   Admin:  http://127.0.0.1:8000/admin/
echo ====================================
echo.
echo IMPORTANTE: deixe esta janela aberta enquanto usar o sistema.
echo Pressione Ctrl+C para parar o servidor.
echo.
pause

start "" http://127.0.0.1:8000
"%PROJECT_DIR%\%VENV_DIR%\Scripts\python.exe" "%PROJECT_DIR%\manage.py" runserver 127.0.0.1:8000

pause
exit /b 0

:run_step
set "STEP_NAME=%~1"
set "STEP_CMD=%~2"
echo.
echo ====================================
echo Etapa: !STEP_NAME!
echo Comando: !STEP_CMD!
echo ====================================
echo.
pause
call !STEP_CMD!
if errorlevel 1 (
    echo.
    echo ERRO na etapa: !STEP_NAME!
    echo Corrija o erro acima e rode novamente este script.
    echo.
    pause
    exit /b 1
)
echo.
echo OK: Etapa concluida com sucesso: !STEP_NAME!
echo.
pause
exit /b 0
