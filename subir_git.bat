@echo off
setlocal

cd /d "%~dp0"

set "GIT_EXE=git"
where git >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files\Git\cmd\git.exe" (
        set "GIT_EXE=C:\Program Files\Git\cmd\git.exe"
    ) else (
        echo Git nao encontrado. Instale o Git ou adicione ao PATH.
        pause
        exit /b 1
    )
)

"%GIT_EXE%" rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo Esta pasta nao e um repositorio Git.
    pause
    exit /b 1
)

set "COMMIT_MSG=%*"
if "%COMMIT_MSG%"=="" (
    set /p COMMIT_MSG=Mensagem do commit: 
)
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=Atualizacao rapida"

echo.
echo [1/4] Baixando atualizacoes do GitHub (pull)...
"%GIT_EXE%" pull --rebase
if errorlevel 1 (
    echo.
    echo ATENCAO: Conflito ao baixar atualizacoes.
    echo Resolva os conflitos nos arquivos marcados e execute novamente.
    echo.
    "%GIT_EXE%" status --short
    pause
    exit /b 1
)

echo [2/4] Adicionando arquivos...
"%GIT_EXE%" add -A
if errorlevel 1 (
    echo Falha ao adicionar arquivos.
    pause
    exit /b 1
)

echo [3/4] Criando commit...
"%GIT_EXE%" commit -m "%COMMIT_MSG%"
if errorlevel 1 (
    echo Nenhuma alteracao para commit.
    "%GIT_EXE%" status --short
    pause
    exit /b 0
)

echo [4/4] Enviando para o GitHub...
"%GIT_EXE%" push
if errorlevel 1 (
    echo.
    echo Falha no push. Verifique autenticacao e conexao.
    pause
    exit /b 1
)

echo.
echo Sucesso! Alteracoes enviadas para o GitHub.
echo.
"%GIT_EXE%" log --oneline -5

endlocal