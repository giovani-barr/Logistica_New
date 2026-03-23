#!/bin/bash

# 🚀 Quick Start Script - Fermap Logística Django

echo "================================"
echo "🚀 Fermap Logística - Setup"
echo "================================"
echo ""

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 não encontrado! Instale Python 3.8+"
    exit 1
fi

echo "✅ Python encontrado: $(python3 --version)"
echo ""

# Criar ambiente virtual
echo "📦 Criando ambiente virtual..."
python3 -m venv venv

# Ativar ambiente virtual
echo "⚡ Ativando ambiente virtual..."
source venv/bin/activate 2>/dev/null || . venv/Scripts/activate 2>/dev/null

# Atualizar pip
echo "🔄 Atualizando pip..."
pip install --upgrade pip

# Instalar dependências
echo "📥 Instalando dependências..."
pip install -r requirements.txt

# Copiar arquivo .env
if [ ! -f .env ]; then
    echo "📝 Criando arquivo .env..."
    cp .env.example .env
    echo "⚠️  Edite o arquivo .env com suas configurações!"
fi

# Criar diretórios necessários
echo "📁 Criando diretórios..."
mkdir -p media
mkdir -p staticfiles

# Executar migrations
echo "🗄️  Executando migrations..."
python manage.py migrate

# Criar superusuário
echo ""
read -p "Deseja criar um novo superusuário? (s/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    python manage.py createsuperuser
fi

# Carregar dados de demonstração
echo ""
read -p "Deseja carregar dados de demonstração? (s/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Ss]$ ]]; then
    echo "📊 Carregando fixtures..."
    python load_fixtures.py
fi

# Coletar static files
echo "🎨 Coletando arquivos static..."
python manage.py collectstatic --noinput

echo ""
echo "================================"
echo "✨ Setup completo!"
echo "================================"
echo ""
echo "Para iniciar o servidor:"
echo "  source venv/bin/activate (macOS/Linux)"
echo "  venv\\Scripts\\activate (Windows)"
echo "  python manage.py runserver"
echo ""
echo "Admin: http://localhost:8000/admin/"
echo "App: http://localhost:8000/"
echo ""
echo "Credenciais padrão (se demo foi criado):"
echo "  Usuário: demo"
echo "  Senha: demo123"
echo ""
