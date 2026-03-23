# 📂 Estrutura do Projeto - Guia Completo

```
logistica_project/
│
├──📄 manage.py                      # Django management
├── 📄 README.md                      # Documentação principal
├── 📄 DEPLOYMENT.md                  # Guias de deployment
├── 📄 API.md                         # Documentação API REST
├── 📄 CONTRIBUTING.md                # Guia de contribuição
├── 📄 requirements.txt                # Dependências Python
├── 📄 .env.example                   # Variáveis de ambiente (exemplo)
├── 📄 .gitignore                     # Arquivos ignorados pelo Git
├── 📄 Procfile                       # Configuração Heroku
├── 📄 runtime.txt                    # Versão Python para Heroku
├── 📄 setup.sh                       # Script setup (Linux/Mac)
├── 📄 setup.bat                      # Script setup (Windows)
├── 📄 load_fixtures.py               # Script para carregar dados demo
│
├── 📁 logistica_project/             # Configuração Django
│   ├── 📄 __init__.py
│   ├── 📄 settings.py                # ⚙️  Configurações principais
│   ├── 📄 urls.py                    # 🔗 URLs principais
│   ├── 📄 wsgi.py                    # WSGI para deployment
│   └── 📄 asgi.py                    # ASGI para async
│
├── 📁 rotas/                         # App Principal de Rotas
│   ├── 📄 __init__.py
│   ├── 📄 apps.py                    # Config da app
│   ├── 📄 models.py                  # 🗄️  Classes do banco de dados
│   ├── 📄 views.py                   # 👁️  Lógica das views
│   ├── 📄 urls.py                    # 🔗 URLs da app
│   ├── 📄 admin.py                   # 👨‍💼 Admin customizado
│   ├── 📄 forms.py                   # 📋 Formulários Django
│   ├── 📄 tests.py                   # 🧪 Testes
│   ├── 📄 signals.py                 # 🔔 Signals Django
│   │
│   ├── 📁 migrations/                # Histórico do banco
│   │   └── 📄 __init__.py
│   │
│   ├── 📁 static/                    # Arquivos estáticos
│   │   ├── 📁 css/
│   │   │   └── 📄 style.css          # 🎨 Estilos principais
│   │   └── 📁 js/
│   │       └── 📄 app.js             # 💻 JavaScript do mapa
│   │
│   └── 📁 templates/                 # Templates HTML
│       └── 📁 rotas/
│           ├── 📄 index.html         # 🗺️  Página do mapa
│           ├── 📄 lista_rotas.html   # 📋 Lista de rotas
│           ├── 📄 detalhe_rota.html  # 📍 Detalhe da rota
│           ├── 📄 editar_rota.html   # ✏️  Editar rota
│           ├── 📄 criar_rota.html    # ➕ Criar rota
│           └── 📄 configuracao_usuario.html  # ⚙️  Configurações
│
├── 📁 api/                           # App de API REST
│   ├── 📄 __init__.py
│   ├── 📄 apps.py                    # Config da app
│   ├── 📄 serializers.py             # 📋 Serializers DRF
│   ├── 📄 views.py                   # 👁️  ViewSets DRF
│   ├── 📄 urls.py                    # 🔗 URLs da API
│   └── 📁 migrations/
│       └── 📄 __init__.py
│
├── 📁 media/                         # Uploads de usuários
│   └── (gerado em tempo de execução)
│
└── 📁 staticfiles/                   # Static files coletados
    └── (gerado em tempo de execução)
```

---

## 🗄️ Modelos de Dados

### Rota
```
┌─────────────────────────┐
│          ROTA           │
├─────────────────────────┤
│ id (Primary Key)        │
│ usuario (FK: User)      │
│ nome                    │
│ descricao               │
│ status                  │
│ distancia_total         │
│ tempo_total             │
│ data_criacao            │
│ data_modificacao        │
│ ativo                   │
└─────────────────────────┘
      ↓ (1:N)
   PARADA
   RotaHistorico
```

### Parada
```
┌─────────────────────────┐
│         PARADA          │
├─────────────────────────┤
│ id (Primary Key)        │
│ rota (FK: Rota)         │
│ sequencia               │
│ cliente_nome            │
│ endereco                │
│ latitude                │
│ longitude               │
│ tipo                    │
│ observacoes             │
│ data_criacao            │
└─────────────────────────┘
```

### ConfiguracaoUsuario
```
┌──────────────────────────┐
│  CONFIGURACAO USUARIO    │
├──────────────────────────┤
│ id (Primary Key)         │
│ usuario (FK: User, 1:1)  │
│ nome_empresa             │
│ telefone_empresa         │
│ localizacao_padrao_lat   │
│ localizacao_padrao_lng   │
│ usar_otimizacao_auto     │
└──────────────────────────┘
```

---

## 🔗 URLs Principais

### Frontend (Views)
```
/                                   # Mapa interativo
/rotas/                             # Lista de rotas
/rotas/criar/                       # Criar nova rota
/rotas/<id>/                        # Detalhe da rota
/rotas/<id>/editar/                 # Editar rota
/rotas/<id>/deletar/                # Deletar rota
/rotas/<id>/pdf/                    # Exportar PDF
/rotas/<id>/csv/                    # Exportar CSV
/configuracao/                      # Configurações do usuário
/admin/                             # Admin Django
```

### API REST
```
/api/rotas/                         # CRUD de rotas
/api/rotas/<id>/otimizar_rota/      # Otimizar rota
/api/rotas/<id>/calcular_rota/      # Calcular distância
/api/rotas/<id>/importar_csv/       # Importar CSV
/api/rotas/<id>/paradas/            # Paradas da rota
/api/paradas/                       # CRUD de paradas
/api/usuarios/meu_perfil/           # Perfil do usuário
/api/configuracao/minha_configuracao/ # Configuração
```

---

## 📊 Fluxo de Dados

```
┌──────────────────────────────────────────────────────────┐
│                   Fermap Logística                       │
└──────────────────────────────────────────────────────────┘
         ↓                                    ↓
    ┌─────────────┐                 ┌────────────────┐
    │  Frontend   │                 │   API REST     │
    │  (Django    │                 │  (DRF)         │
    │  Templates) │                 │                │
    └─────────────┘                 └────────────────┘
         ↓                                    ↓
┌─────────────────────────────────────────────┐
│      Database (SQLite/PostgreSQL)            │
├─────────────────────────────────────────────┤
│  • Rota                                      │
│  • Parada                                    │
│  • RotaHistorico                             │
│  • ConfiguracaoUsuario                       │
│  • User (Django Auth)                        │
└─────────────────────────────────────────────┘
```

---

## 🔐 Autenticação & Permissões

```
┌──────────────────┐
│  Usuário entra   │
└────────┬─────────┘
         ↓
┌──────────────────────────────┐
│  Django Login/SessionAuth     │
│  (ou Token Auth para API)     │
└────────┬─────────────────────┘
         ↓
┌──────────────────────────────┐
│  Permissões por Usuário       │
│  • Próprias rotas             │
│  • Admin: todas rotas         │
│  • Staffuser: read-only       │
└────────┬─────────────────────┘
         ↓
┌──────────────────────────────┐
│  ConfiguracaoUsuario criada   │
│  automaticamente via signal   │
└──────────────────────────────┘
```

---

## 📦 Dependências Principais

### Django & DRF
- `Django==4.2.8` - Framework web
- `djangorestframework==3.14.0` - API REST
- `django-cors-headers==4.3.1` - CORS
- `django-filters==23.4` - Filtros

### Database
- `psycopg2-binary==2.9.9` - PostgreSQL driver
- SQLite (padrão, nativo)

### Utilities
- `Pillow==10.1.0` - Processamento de imagens
- `reportlab==4.0.7` - Geração de PDF
- `requests==2.31.0` - HTTP requests
- `python-decouple==3.8` - Variáveis de ambiente
- `whitenoise==6.6.0` - Static files em produção

### Deployment
- `gunicorn==21.2.0` - Application server

---

## 🧪 Тestando

```
Estrutura de Testes:
├── rotas/tests.py              # Testes da app rotas
└── api/                        # Testes da API (pode criar)

Rodando testes:
python manage.py test
python manage.py test rotas.tests
python manage.py test --verbosity=2

Com cobertura:
pip install coverage
coverage run --source='.' manage.py test
coverage report
coverage html
```

---

## 🚀 Performance

### Otimizações Implementadas
- Select_related & prefetch_related para queries
- Paginação (50 items/página)
- Caching de dados estáticos
- WhiteNoise para Static Files
- Índices no banco de dados

### Futuras Otimizações
- Redis cache
- Celery para tasks assíncronas
- Database connection pooling
- CDN para static files

---

## 🔧 Configurações Importantes

### settings.py
```python
DEBUG = False                    # Em produção
SECRET_KEY = 'aleatorio'        # Mude em produção!
ALLOWED_HOSTS = ['seu-dominio'] # Configure corretamente
CORS_ALLOWED_ORIGINS = [...]    # Apenas origens necessárias
```

### .env
```
GOOGLE_MAPS_API_KEY=sua-chave
OSRM_ROUTER_URL=https://router.project-osrm.org/route/v1
WHATSAPP_API_TOKEN=seu-token
EMAIL_HOST_PASSWORD=sua-senha-app
```

---

## 📚 Convenções de Código

### Models
```python
class MinhaClasse(models.Model):
    campo_principal = models.CharField(max_length=255)
    
    class Meta:
        ordering = ['-data_criacao']
        verbose_name = 'Minha Classe'
    
    def __str__(self):
        return self.campo_principal
```

### Views
```python
@login_required
def minha_view(request):
    queryset = MinhaClasse.objects.filter(usuario=request.user)
    return render(request, 'template.html', {'data': queryset})
```

### API ViewSets
```python
class MinhaViewSet(viewsets.ModelViewSet):
    queryset = MinhaClasse.objects.all()
    serializer_class = MinhaSerializer
    permission_classes = [permissions.IsAuthenticated]
```

---

## 📞 Troubleshooting

### Problema: ImportError em models.py
**Solução:** Verifique se tem `__init__.py` em migrations/

### Problema: Static files não carregam
**Solução:** Execute `python manage.py collectstatic`

### Problema: Port 8000 já em uso
**Solução:** Use `python manage.py runserver 8001`

### Problema: Database locked
**Solução:** Delete db.sqlite3 e rode migrations novamente

---

Mais informações em: [Django Docs](https://docs.djangoproject.com/)
