@echo off
REM 🚀 Quick Start Script - Fermap Logística Django (Windows)

echo ================================
echo 🚀 Fermap Logística - Setup
echo ================================
echo.

REM Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python não encontrado! Instale Python 3.8+
    exit /b 1
)

echo ✅ Python encontrado:
python --version
echo.

REM Criar ambiente virtual
echo 📦 Criando ambiente virtual...
python -m venv venv

REM Ativar ambiente virtual
echo ⚡ Ativando ambiente virtual...
call venv\Scripts\activate.bat

REM Atualizar pip
echo 🔄 Atualizando pip...
python -m pip install --upgrade pip

REM Instalar dependências
echo 📥 Instalando dependências...
pip install -r requirements.txt

REM Copiar arquivo .env
if not exist .env (
    echo 📝 Criando arquivo .env...
    copy .env.example .env
    echo ⚠️  Edite o arquivo .env com suas configurações!
)

REM Criar diretórios necessários
echo 📁 Criando diretórios...
if not exist media mkdir media
if not exist staticfiles mkdir staticfiles

REM Executar migrations
echo 🗄️  Executando migrations...
python manage.py migrate

REM Coletar static files
echo 🎨 Coletando arquivos static...
python manage.py collectstatic --noinput

echo.
echo ================================
echo ✨ Setup completo!
echo ================================
echo.
echo Para iniciar o servidor:
echo   venv\Scripts\activate
echo   python manage.py runserver
echo.
echo Admin: http://localhost:8000/admin/
echo App: http://localhost:8000/
echo.
echo Para criar superusuário:
echo   python manage.py createsuperuser
echo.
echo Para carregar dados demo:
echo   python load_fixtures.py
echo.
pause
