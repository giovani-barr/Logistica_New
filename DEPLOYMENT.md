# 📖 Guia de Deployment - Fermap Logística

## 🌐 Deploy em Heroku

### Pré-requisitos
- Conta Heroku
- Heroku CLI instalado
- Git configurado

### Passos

1. **Login no Heroku**
```bash
heroku login
```

2. **Criar app Heroku**
```bash
heroku create seu-app-name
```

3. **Adicionar PostgreSQL**
```bash
heroku addons:create heroku-postgresql:hobby-dev
```

4. **Configurar variáveis de ambiente**
```bash
heroku config:set DEBUG=False
heroku config:set SECRET_KEY=sua-chave-super-secreta
heroku config:set GOOGLE_MAPS_API_KEY=sua-chave
```

5. **Deploy**
```bash
git push heroku main
```

6. **Executar migrations**
```bash
heroku run python manage.py migrate
heroku run python manage.py createsuperuser
```

## 🐳 Deploy com Docker

### Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y postgresql-client

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["gunicorn", "logistica_project.wsgi:application", "--bind", "0.0.0.0:8000"]
```

### Docker Compose
```yaml
version: '3.9'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: logistica
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  web:
    build: .
    command: gunicorn logistica_project.wsgi:application --bind 0.0.0.0:8000
    ports:
      - "8000:8000"
    environment:
      DEBUG: "False"
      SECRET_KEY: seu-secret-key
      DB_ENGINE: django.db.backends.postgresql
      DB_NAME: logistica
      DB_USER: postgres
      DB_PASSWORD: postgres
      DB_HOST: db
      DB_PORT: 5432
    depends_on:
      - db

volumes:
  postgres_data:
```

### Executar com Docker
```bash
docker-compose up -d
docker-compose exec web python manage.py migrate
docker-compose exec web python manage.py createsuperuser
```

## ☁️ Deploy em AWS EC2

### 1. Criar instância EC2 (Ubuntu 22.04)

### 2. Conectar e atualizar sistema
```bash
ssh -i sua-chave.pem ubuntu@seu-ip-publico
sudo apt update && sudo apt upgrade -y
```

### 3. Instalar dependências
```bash
sudo apt install -y python3-pip python3-venv postgresql postgresql-contrib nginx
```

### 4. Clonar repositório
```bash
cd /home/ubuntu
git clone seu-repositorio
cd logistica_project
```

### 5. Criar environment virtual
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 6. Configurar PostgreSQL
```bash
sudo -u postgres psql
CREATE DATABASE logistica;
CREATE USER logistica_user WITH PASSWORD 'sua-senha';
ALTER ROLE logistica_user SET client_encoding TO 'utf8';
ALTER ROLE logistica_user SET default_transaction_isolation TO 'read committed';
GRANT ALL PRIVILEGES ON DATABASE logistica TO logistica_user;
\q
```

### 7. Configurar Django
```bash
python manage.py migrate
python manage.py createsuperuser
python manage.py collectstatic --noinput
```

### 8. Configurar Gunicorn
```bash
pip install gunicorn
# Criar arquivo /home/ubuntu/logistica_project/gunicorn_config.py
```

### 9. Configurar Nginx
```bash
sudo nano /etc/nginx/sites-available/logistica
```

```nginx
upstream logistica {
    server 127.0.0.1:8000;
}

server {
    listen 80;
    server_name seu-dominio.com;

    location /static/ {
        alias /home/ubuntu/logistica_project/staticfiles/;
    }

    location /media/ {
        alias /home/ubuntu/logistica_project/media/;
    }

    location / {
        proxy_pass http://logistica;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/logistica /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 10. Criar serviço systemd
```bash
sudo nano /etc/systemd/system/logistica.service
```

```ini
[Unit]
Description=Fermap Logistica Django Application
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/logistica_project
ExecStart=/home/ubuntu/logistica_project/venv/bin/gunicorn \
          --workers 3 \
          --bind 127.0.0.1:8000 \
          logistica_project.wsgi:application

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable logistica
sudo systemctl start logistica
```

## 🔒 Configuração SSL com Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d seu-dominio.com
sudo certbot renew --dry-run
```

## 📊 Monitoramento

### Logs
```bash
# Docker
docker-compose logs -f web

# Systemd
sudo journalctl -u logistica -f

# Nginx
sudo tail -f /var/log/nginx/error.log
```

### Health Check
```bash
curl -I http://localhost:8000
```

## 🚀 Performance Optimization

### Cache
```python
# settings.py
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': 'redis://127.0.0.1:6379/1',
    }
}
```

### Compress Responses
```python
MIDDLEWARE = [
    'django.middleware.gzip.GZipMiddleware',
    # ... outros middlewares
]
```

### Database Connection Pooling
```bash
pip install django-db-geventpool
```

## 🔄 CI/CD com GitHub Actions

Crie `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Heroku

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy to Heroku
        env:
          HEROKU_API_KEY: ${{ secrets.HEROKU_API_KEY }}
        run: |
          git remote add heroku https://git.heroku.com/seu-app.git
          git push heroku main
```

## 📋 Checklist de Produção

- [ ] DEBUG = False
- [ ] SECRET_KEY alterada
- [ ] ALLOWED_HOSTS configurado
- [ ] HTTPS habilitado
- [ ] PostgreSQL ou banco robusto em uso
- [ ] Backups do banco configurados
- [ ] Email configurado
- [ ] Logging ativado
- [ ] CORS configurado corretamente
- [ ] Static files servidos corretamente
- [ ] Rate limiting configurado
- [ ] Monitoramento ativo

## 🐛 Troubleshooting

### Erro de Static Files
```bash
python manage.py collectstatic --clear --noinput
```

### Erro de Database Connection
```bash
python manage.py dbshell # Testar conexão
```

### Error 502 Bad Gateway
```bash
# Verificar acessibilidade de Gunicorn
curl http://127.0.0.1:8000
```

---

Para mais informações, consulte a [documentação oficial do Django](https://docs.djangoproject.com/en/4.2/howto/deployment/)
