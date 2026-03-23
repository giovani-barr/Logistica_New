@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo  +=======================================================+
echo  |     Fermap Logistica - Instalador Guiado (Windows)    |
echo  +=======================================================+
echo.
echo Este script faz tudo passo a passo.
echo Em cada etapa: pressione qualquer tecla para continuar.
echo Se houver erro, o script para e mostra a etapa.
echo.
pause

echo [1/8] Verificando Python...
call :run_step "Checar versao do Python" "python --version"

echo [2/8] Criando ou reutilizando ambiente virtual...
if exist .venv\Scripts\python.exe (
    echo OK: Ambiente .venv ja existe.
    echo.
    pause
) else (
    call :run_step "Criar ambiente virtual .venv" "python -m venv .venv"
)

if not exist .venv\Scripts\python.exe (
    echo.
    echo ERRO: Nao foi possivel preparar o ambiente virtual .venv.
    pause
    exit /b 1
)

echo [3/8] Atualizando pip...
call :run_step "Atualizar pip no .venv" ".venv\Scripts\python.exe -m pip install --upgrade pip"

echo [4/8] Instalando dependencias do backend...
call :run_step "Instalar requirements.txt" ".venv\Scripts\python.exe -m pip install -r requirements.txt"

echo [5/8] Configurando arquivo .env...
if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo OK: Arquivo .env criado a partir de .env.example.
    ) else (
        (
            echo DEBUG=True
            echo SECRET_KEY=troque-esta-chave-em-producao
            echo ALLOWED_HOSTS=localhost,127.0.0.1
            echo OSRM_ROUTER_URL=https://router.project-osrm.org/route/v1
            echo CORS_ALLOWED_ORIGINS=http://localhost:8000
        ) > .env
        echo OK: Arquivo .env basico criado.
    )
    echo.
    echo IMPORTANTE: se necessario, edite o arquivo .env antes de usar em producao.
) else (
    echo OK: Arquivo .env ja existe. Nada alterado.
)
echo.
pause

echo [6/8] Preparando banco e arquivos estaticos...
if not exist media mkdir media
if not exist staticfiles mkdir staticfiles
call :run_step "Aplicar migracoes" ".venv\Scripts\python.exe manage.py migrate"
call :run_step "Coletar estaticos" ".venv\Scripts\python.exe manage.py collectstatic --noinput --verbosity 0"

echo [7/8] Criar usuario administrador...
echo Este passo e opcional.
set /p CRIAR_ADMIN=Criar admin agora? S=Sim / N=Nao: 
if /i "!CRIAR_ADMIN!"=="S" (
    call :run_step "Criar superusuario" ".venv\Scripts\python.exe manage.py createsuperuser"
) else (
    echo OK: Etapa de superusuario ignorada.
    echo.
    pause
)

echo [8/8] Instalacao concluida.
echo.
echo  +=======================================================+
echo  |          Instalacao concluida com sucesso             |
echo  |  Proximo passo: execute iniciar.bat                   |
echo  |  Sistema: http://localhost:8000/                      |
echo  |  Admin:   http://localhost:8000/admin/                |
echo  +=======================================================+
echo.

set /p ABRIR=Iniciar o servidor agora? S=Sim / N=Nao: 
if /i "!ABRIR!"=="S" (
    call :run_step "Iniciar servidor Django" ".venv\Scripts\python.exe manage.py runserver 8000"
)

echo.
echo Fim do instalador.
pause
exit /b 0

:run_step
set "STEP_NAME=%~1"
set "STEP_CMD=%~2"
echo.
echo ---------------------------------------------------------
echo Etapa: !STEP_NAME!
echo Comando: !STEP_CMD!
echo ---------------------------------------------------------
echo.
pause
call !STEP_CMD!
if errorlevel 1 (
    echo.
    echo ERRO: Falha na etapa: !STEP_NAME!
    echo Verifique a mensagem acima e tente novamente.
    echo.
    pause
    exit /b 1
)
echo.
echo OK: Etapa concluida com sucesso: !STEP_NAME!
echo.
pause
exit /b 0
