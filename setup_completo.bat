@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

echo ====================================
echo   Fermap Logistica - Primeira Execucao
echo ====================================
echo.

cd /d "%~dp0"

echo [0/7] Detectando ambiente virtual...
if exist .venv\Scripts\python.exe (
	set "VENV_DIR=.venv"
) else if exist venv\Scripts\python.exe (
	set "VENV_DIR=venv"
) else (
	set "VENV_DIR=.venv"
	call :run_step "Criar ambiente virtual" "python -m venv .venv"
)

if not exist "%VENV_DIR%\Scripts\python.exe" (
	echo.
	echo ERRO: Ambiente virtual nao encontrado ou invalido.
	echo Verifique sua instalacao do Python e tente novamente.
	pause
	exit /b 1
)

echo Ambiente selecionado: %VENV_DIR%
echo.
pause

call :run_step "Atualizar pip" "%VENV_DIR%\Scripts\python.exe -m pip install --upgrade pip"
call :run_step "Instalar dependencias do requirements" "%VENV_DIR%\Scripts\python.exe -m pip install -r requirements.txt"
call :run_step "Aplicar migracoes" "%VENV_DIR%\Scripts\python.exe manage.py migrate"

echo.
echo [6/7] Criar superusuario (administrador)
echo Esse passo e interativo e pode ser ignorado com Ctrl+C.
echo.
pause
"%VENV_DIR%\Scripts\python.exe" manage.py createsuperuser
if errorlevel 1 (
	echo.
	echo AVISO: Superusuario nao foi criado ou foi cancelado.
	echo Voce pode criar depois com:
	echo "%VENV_DIR%\Scripts\python.exe" manage.py createsuperuser
) else (
	echo.
	echo OK: Superusuario criado com sucesso.
)
echo.
pause

echo [7/7] Configuracao concluida.
echo.
echo ====================================
echo   Para iniciar o servidor, execute:
echo   iniciar.bat
echo ====================================
echo.
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
