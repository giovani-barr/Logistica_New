# ✅ Checklist de Inicialização - Fermap Logística

## 🎯 Primeiro Acesso - Passo a Passo

### 1️⃣ Clonar e Configurar
- [ ] Clonar repositório: `git clone ...`
- [ ] Acessar pasta: `cd logistica_project`
- [ ] Executar setup: `./setup.sh` (Linux/Mac) ou `setup.bat` (Windows)
- [ ] Editar `.env` com suas chaves

### 2️⃣ Banco de Dados  
- [ ] Verificar se migrations rodaram
- [ ] Criar superusuário: `python manage.py createsuperuser`
- [ ] Carregar dados demo: `python load_fixtures.py` (opcional)

### 3️⃣ Iniciar Servidor
- [ ] Executar: `python manage.py runserver`
- [ ] Acessar: `http://localhost:8000`
- [ ] Admin: `http://localhost:8000/admin/`

### 4️⃣ Primeiro Teste
- [ ] Login com superusuário
- [ ] Criar rota no mapa
- [ ] Adicionar 3+ paradas
- [ ] Otimizar rota
- [ ] Exportar PDF

---

## 🔧 Configurações Essenciais

### Antes de Ir pro Produção:

**settings.py**
- [ ] `DEBUG = False`
- [ ] `SECRET_KEY` alterado
- [ ] `ALLOWED_HOSTS` configurado
- [ ] Database para PostgreSQL (recomendado)

**.env**
- [ ] `GOOGLE_MAPS_API_KEY` adicionado
- [ ] Email configurado (se necessário)
- [ ] `CORS_ALLOWED_ORIGINS` correto

**Security**
- [ ] HTTPS habilitado
- [ ] CSRF_TRUSTED_ORIGINS configurado
- [ ] Backups do banco automáticos

---

## 🚀 Deploy

### Heroku
- [ ] Criar app: `heroku create seu-app`
- [ ] Adicionar PostgreSQL: `heroku addons:create heroku-postgresql`
- [ ] Configurar venv: `heroku config:set ...`
- [ ] Deploy: `git push heroku main`
- [ ] Migrations: `heroku run python manage.py migrate`

### Docker
- [ ] Build: `docker-compose build`
- [ ] Run: `docker-compose up -d`
- [ ] Migrations: `docker-compose exec web python manage.py migrate`

### AWS/VPS
- [ ] Instalar dependências: `apt install python3 postgresql nginx`
- [ ] Setup venv e requirements
- [ ] Configurar Nginx + Gunicorn
- [ ] Certificado SSL com Let's Encrypt

---

## 📊 Dados de Teste

### Usuário Demo (se carregar fixtures)
```
Usuário: demo
Senha: demo123
Email: demo@fermap.com
```

### Dados Incluídos:
- 3 rotas de exemplo
- 9 paradas distribuídas
- Configuração pré-definida

### Criar Seu Próprio Usuário:
```bash
python manage.py createsuperuser
# Seguir as instruções
```

---

## 🧪 Testes & Validação

### Rodar Testes
```bash
# Todos os testes
python manage.py test

# App específica
python manage.py test rotas

# Com verbosidade
python manage.py test --verbosity=2
```

### Coverage
```bash
pip install coverage
coverage run --source='.' manage.py test
coverage report
coverage html
```

### API Testing
- Postman: Importar collection
- cURL: Exemplos em API.md
- Python requests: Ver API.md

---

## 🎨 Customização

### Modificar Cores
Arquivo: `rotas/static/css/style.css`
```css
:root {
    --p: #4285F4;      /* Azul primário */
    --s: #34A853;      /* Verde secundário */
    --orange: #ed8936; /* Laranja */
}
```

### Modificar Logo/Branding
- `rotas/templates/rotas/*.html` - Títulos
- `rotas/static/` - Adicionar imagens
- `logistica_project/settings.py` - Admin customizado

### Adicionar Campos Customizados
1. Editar `rotas/models.py`
2. Criar migration: `python manage.py makemigrations`
3. Aplicar: `python manage.py migrate`
4. Atualizar templates

---

## 📱 Mobile

### Responsividade
- Layout CSS já é responsivo
- Testado em: iPhone, Android, Tablet
- Use DevTools (F12) para testar

### Future App Native
- Ver roadmap em CONTRIBUTING.md
- React Native planejado para v1.2

---

## 🔗 Recursos Úteis

### Documentação
- README.md - Visão geral
- API.md - Endpoints REST
- DEPLOYMENT.md - Como publicar
- PROJECT_STRUCTURE.md - Estrutura
- CONTRIBUTING.md - How to contribute

### Links Externos
- [Django Docs](https://docs.djangoproject.com/)
- [DRF Docs](https://www.django-rest-framework.org/)
- [Leaflet Docs](https://leafletjs.com/)
- [Google Maps API](https://developers.google.com/maps)

---

## ✨ Features Mais Usadas

### 0. SQL + Card (Firebird)
1. HOME (`/`)
2. No painel de pedidos, clique `⚙ SQL + Card`
3. Edite/teste o SQL e salve
4. Selecione e ordene os campos do card
5. Salve as configurações

### 1. Criar Rota com Mapa
1. HOME (`/`)
2. Buscar endereço no autocomplete
3. Clique para confirmar
4. Edite nome e obs.
5. Clique "Confirmar Adição"

### 2. Otimizar Rota
1. Adicione 3+ paradas
2. Clique "✨ Otimizar Rota"
3. Ordem será reordenada
4. Visualize no mapa

### 3. Exportar PDF
1. Acesse uma rota
2. Clique "📄 Exportar PDF"
3. Download automático

### 4. Importar CSV
1. Prepare arquivo CSV (ver exemplo)
2. Clique "📁 Importar CSV"
3. Select arquivo
4. Aguarde processamento

### 5. Compartilhar WhatsApp
1. Adicione paradas
2. Clique "💬 WhatsApp"
3. Compartilhe com cliente

---

## 🆘 SAOs (SOPs - Standard Operating Procedures)

### Backup do Banco
```bash
# SQLite
cp db.sqlite3 db.sqlite3.backup

# PostgreSQL
pg_dump logistica > backup.sql
```

### Restaurar Banco
```bash
# SQLite
cp db.sqlite3.backup db.sqlite3

# PostgreSQL
psql logistica < backup.sql
```

### Limpar Cache
```bash
python manage.py shell
from django.core.cache import cache
cache.clear()
```

### Reset Banco (Desenvolvimento)
```bash
rm db.sqlite3
python manage.py migrate
python manage.py createsuperuser
```

---

## 📞 Suporte & Feedback

### Reportar Bug
→ Abra issue em GitHub com template de bug

### Sugerir Feature
→ Abra discussion ou issue com tag `enhancement`

### Contribuir
→ Ver CONTRIBUTING.md para diretrizes

### Contato
- Email: dev@fermap-logistica.com
- GitHub: [seu-repo]
- Issues: [seu-repo]/issues

---

## 🎓 Próximos Passos

1. **Entender Estrutura**
   - Leia PROJECT_STRUCTURE.md
   - Explore as pastas principais

2. **Estudar Código**
   - Ver models.py
   - Entender views.py
   - Analgar serializers.py

3. **Testar API**
   - Use exemplos em API.md
   - Teste endpoints com Postman

4. **Customizar**
   - Adicione campos customizados
   - Modifique templates
   - Implemente novas features

5. **Deploy**
   - Escolha plataforma
   - Siga DEPLOYMENT.md
   - Configure CI/CD

---

## 📈 Métricas de Sucesso

- ✅ Aplicação rodando sem erros
- ✅ Mapa interativo funcional
- ✅ Rotas criadas e otimizadas
- ✅ Admin acessível
- ✅ API respondendo corretamente
- ✅ Testes passando

---

**Você está pronto para começar! 🚀**

Qualquer dúvida, consulte a documentação ou abra uma issue.
