# 🚛 Fermap Logística - Django Edition

Sistema completo de gerenciamento de rotas de entrega com integração de mapas interativos, otimização de rotas, importação/exportação CSV e PDF, e integração com WhatsApp.

## ✨ Características

- 🗺️ **Mapa Interativo** com Leaflet e OpenStreetMap
- 📍 **Geocodificação** integrada com Google Places API
- 🧭 **Otimização de Rotas** usando algoritmo 2-Opt
- 📊 **Cálculo de Distância e Tempo** via OSRM
- 📝 **Importação/Exportação CSV**
- 📄 **Geração de PDF** com ReportLab
- 💬 **Integração WhatsApp**
- 🔐 **Autenticação e Permissões** Django
- 🛠️ **Admin Dashboard** completo
- ⚡ **API REST** com Django REST Framework
- 📱 **Responsivo** para mobile e desktop

## 🚀 Instalação

### 1. Pré-requisitos
- Python 3.8+
- pip
- PostgreSQL (opcional, SQLite padrão)

### 2. Início Rápido (Windows)

**🎯 Primeira vez configurando o projeto:**
```batch
# Execute uma vez para configurar tudo
setup_completo.bat
```

Este script irá:
- ✅ Ativar o ambiente virtual
- ✅ Instalar todas as dependências
- ✅ Configurar o banco de dados
- ✅ Criar um superusuário (admin)

**🚀 Para iniciar o servidor:**
```batch
# Use sempre que quiser rodar o projeto
iniciar.bat
```

O servidor estará disponível em: **http://localhost:8000**

---

### 3. Instalação Manual (Alternativa)

```bash
# Clonar repositório
git clone <seu_repo>
cd logistica_project

# Criar ambiente virtual
python -m venv venv

# Ativar ambiente virtual
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt
```

### 4. Configurar Variáveis de Ambiente (Opcional)

### 4. Configurar Variáveis de Ambiente (Opcional)

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar .env com suas chaves (Google Maps, WhatsApp, etc)
```

### 5. Configurar Banco de Dados (se instalação manual)

```bash
# Aplicar migrations
python manage.py migrate

# Criar superusuário
python manage.py createsuperuser
```

### 6. Executar Servidor (se instalação manual)

```bash
python manage.py runserver
```

Acessar em: **http://localhost:8000**

---

## 📋 Uso

### Login e Acesso
1. Abra o navegador em `http://localhost:8000`
2. Faça login com o superusuário criado
3. Configure a conexão Firebird (se necessário)
3. Clicar em "Novo Mapa" ou "Minhas Rotas"

### Criar Rota no Mapa

1. **Adicionar Paradas:**
   - Buscar endereço com Google Places (autocomplete)
   - Ou usar coordenadas (Lat, Long)
   - Adicionar nome do cliente e observações

2. **Otimizar Rota:**
   - Clique "✨ Otimizar Rota" (2-Opt algorithm)
   - Clique "🔄 Inverter (Meio)" para reverter ordem

3. **Exportar:**
   - **PDF**: Clique "📄 Gerar PDF"
   - **CSV**: Clique "📁 Importar CSV" (para importar paradas)
   - **WhatsApp**: Clique "💬 WhatsApp"

4. **Arrastar Paradas:**
   - Arraste paradas na lista lateral para reordenar
   - Duplo-clique para editar observações

### Importar CSV

Formato esperado:
```csv
cliente_nome;cliente_telefone;endereco;latitude;longitude;observacoes
João Silva;11991234567;Rua A, 100;-0.034987;-51.074846;Frágil
Maria Santos;11987654321;Av B, 200;-0.035000;-51.075000;Piso 3
```

### API REST

Base URL: `http://localhost:8000/api/`

Endpoints:
- `GET/POST /rotas/` - Listar/Criar rotas
- `GET/PUT/DELETE /rotas/<id>/` - Detalhe rota
- `POST /rotas/<id>/otimizar_rota/` - Otimizar rota
- `POST /rotas/<id>/calcular_rota/` - Calcular distância
- `POST /rotas/<id>/importar_csv/` - Importar CSV
- `GET /rotas/<id>/exportar_pdf/` - Exportar PDF
- `GET/POST /paradas/` - Listar/Criar paradas
- `GET /usuarios/meu_perfil/` - Perfil do usuário

## 🔧 Configuração Avançada

### Usando PostgreSQL

Descomente no `.env`:
```
DB_ENGINE=django.db.backends.postgresql
DB_NAME=logistica_db
DB_USER=postgres
DB_PASSWORD=senha
DB_HOST=localhost
DB_PORT=5432
```

### Google Maps API

1. Criar chave em [Google Cloud Console](https://console.cloud.google.com/)
2. Adicionar `GOOGLE_MAPS_API_KEY` no `.env`

### WhatsApp Business API

1. Obter token em [Meta for Developers](https://developers.facebook.com/)
2. Adicionar `WHATSAPP_API_TOKEN` no `.env`

## 📊 Admin Dashboard

Acesso: `http://localhost:8000/admin/`

Gerenciar:
- ✅ Rotas
- ✅ Paradas
- ✅ Histórico de Rotas
- ✅ Configurações de Usuários

## 🗂️ Estrutura do Projeto

```
logistica_project/
├── logistica_project/        # Config Django
│   ├── settings.py
│   ├── urls.py
│   ├── wsgi.py
│   └── asgi.py
├── rotas/                     # App Principal
│   ├── models.py             # BD Models
│   ├── views.py              # Views Web
│   ├── admin.py              # Admin
│   ├── urls.py
│   ├── templates/            # HTML
│   └── static/               # CSS/JS
├── api/                       # API REST
│   ├── serializers.py
│   ├── views.py
│   └── urls.py
├── manage.py
├── requirements.txt
├── .env.example
└── README.md
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'Add nova-feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob licença MIT.

## 📞 Suporte

Para problemas ou sugestões, abra uma issue ou entre em contato.

## 🎯 Roadmap

- [ ] Integração com múltiplos motoristas
- [ ] Notificações em tempo real (WebSocket)
- [ ] Análise de rotas e relatórios
- [ ] Integração com sistemas ERP
- [ ] App Mobile nativa
- [ ] Rastreamento GPS em tempo real
- [ ] Previsão de demanda com IA

---

Desenvolvido com ❤️ para otimizar sua logística
