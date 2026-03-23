# 📡 API REST - Documentação Completa

## Base URL
```
http://localhost:8000/api/
```

## Autenticação
Use Session Authentication. Login via `/admin/` ou endpoint de login.

```bash
# Headers necessários
Content-Type: application/json
Authorization: Token seu-token (se usar Token Auth)
```

---

## 📍 Rotas (Routes)

### Listar Rotas
```http
GET /api/rotas/
```

**Query Parameters:**
- `status` - Filtrar por status (planejamento, em_andamento, concluída, cancelada)
- `data_entrega` - Filtrar por data
- `ativo` - Filtrar por ativo (true/false)
- `page` - Número da página

**Response:**
```json
{
  "count": 10,
  "next": "http://localhost:8000/api/rotas/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "nome": "Rota Centro",
      "usuario_nome": "Demo User",
      "status": "em_andamento",
      "data_criacao": "2026-02-13T10:30:00Z",
      "distancia_total": 25.5,
      "tempo_total": 120,
      "num_paradas": 5
    }
  ]
}
```

### Criar Rota
```http
POST /api/rotas/
Content-Type: application/json

{
  "nome": "Nova Rota",
  "descricao": "Descrição da rota",
  "status": "planejamento",
  "data_entrega": "2026-02-20"
}
```

### Detalhe Rota
```http
GET /api/rotas/{id}/
```

**Response:**
```json
{
  "id": 1,
  "usuario": 1,
  "usuario_nome": "Demo User",
  "nome": "Rota Centro",
  "descricao": "Entrega no centro",
  "status": "em_andamento",
  "distancia_total": 25.5,
  "tempo_total": 120,
  "observacoes": "Tomar cuidado com trânsito",
  "ativo": true,
  "paradas": [
    {
      "id": 1,
      "sequencia": 1,
      "cliente_nome": "João Silva",
      "cliente_telefone": "11991234567",
      "endereco": "Rua A, 100",
      "latitude": -0.034987,
      "longitude": -51.074846,
      "tipo": "entrega",
      "observacoes": "Entrega no 3º andar"
    }
  ]
}
```

### Atualizar Rota
```http
PUT /api/rotas/{id}/
PATCH /api/rotas/{id}/

{
  "nome": "Nome atualizado",
  "status": "concluída"
}
```

### Deletar Rota
```http
DELETE /api/rotas/{id}/
```

### Otimizar Rota
```http
POST /api/rotas/{id}/otimizar_rota/
```

Otimiza a ordem das paradas usando algoritmo 2-Opt.

**Response:**
```json
{
  "mensagem": "Rota otimizada com sucesso",
  "paradas": [...]
}
```

### Calcular Distância e Tempo
```http
POST /api/rotas/{id}/calcular_rota/
```

Calcula distância total e tempo via OSRM.

**Response:**
```json
{
  "distancia_total": 25.5,
  "tempo_total": 120
}
```

### Importar CSV
```http
POST /api/rotas/{id}/importar_csv/
Content-Type: multipart/form-data

arquivo: <arquivo.csv>
```

**Formato CSV:**
```
cliente_nome;cliente_telefone;endereco;latitude;longitude;observacoes
João Silva;11991234567;Rua A, 100;-0.034987;-51.074846;Frágil
```

**Response:**
```json
{
  "mensagem": "3 paradas importadas com sucesso",
  "paradas_criadas": 3
}
```

### Exportar PDF
```http
GET /api/rotas/{id}/exportar_pdf/
```

Retorna PDF da rota.

### Histórico da Rota
```http
GET /api/rotas/{id}/historico/
```

**Response:**
```json
[
  {
    "id": 1,
    "usuario_nome": "Demo User",
    "acao": "criacao",
    "descricao": "Rota criada",
    "data_hora": "2026-02-13T10:30:00Z"
  }
]
```

### Paradas da Rota
```http
GET /api/rotas/{id}/paradas/
```

---

## 🛑 Paradas (Stops)

### Listar Paradas
```http
GET /api/paradas/
```

**Query Parameters:**
- `rota` - ID da rota
- `tipo` - Tipo de parada

### Criar Parada
```http
POST /api/paradas/
Content-Type: application/json

{
  "rota": 1,
  "sequencia": 1,
  "cliente_nome": "Cliente Novo",
  "cliente_telefone": "11987654321",
  "endereco": "Rua B, 200",
  "latitude": -0.035000,
  "longitude": -51.075000,
  "tipo": "entrega",
  "observacoes": "Sem observações"
}
```

### Atualizar Parada
```http
PUT /api/paradas/{id}/
PATCH /api/paradas/{id}/
```

### Deletar Parada
```http
DELETE /api/paradas/{id}/
```

---

## 👤 Usuários (Users)

### Meu Perfil
```http
GET /api/usuarios/meu_perfil/
```

**Response:**
```json
{
  "id": 1,
  "username": "demo",
  "email": "demo@fermap.com",
  "first_name": "Demo",
  "last_name": "User",
  "configuracao": {
    "id": 1,
    "localizacao_padrao_lat": -0.034987,
    "localizacao_padrao_lng": -51.074846,
    "nome_empresa": "FERMAP Logística",
    "usar_otimizacao_automatica": true
  }
}
```

### Listar Usuários (Admin)
```http
GET /api/usuarios/
```

---

## ⚙️ Configurações

### Minha Configuração
```http
GET /api/configuracao/minha_configuracao/
PUT /api/configuracao/minha_configuracao/

{
  "nome_empresa": "Minha Empresa",
  "telefone_empresa": "11991234567",
  "email_empresa": "contato@empresa.com",
  "localizacao_padrao_lat": -0.034987,
  "localizacao_padrao_lng": -51.074846,
  "usar_otimizacao_automatica": true,
  "permitir_compartilhamento": false
}
```

---

## 🧪 Testando a API

### Com cURL

**Listar rotas:**
```bash
curl -X GET http://localhost:8000/api/rotas/ \
  -H "Authorization: Token seu-token"
```

**Criar rota:**
```bash
curl -X POST http://localhost:8000/api/rotas/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Token seu-token" \
  -d '{
    "nome": "Nova Rota",
    "status": "planejamento"
  }'
```

**Importar CSV:**
```bash
curl -X POST http://localhost:8000/api/rotas/1/importar_csv/ \
  -H "Authorization: Token seu-token" \
  -F "arquivo=@rotas.csv"
```

### Com Python Requests

```python
import requests

BASE_URL = 'http://localhost:8000/api'
TOKEN = 'seu-token'

headers = {
    'Authorization': f'Token {TOKEN}',
    'Content-Type': 'application/json'
}

# Listar rotas
response = requests.get(f'{BASE_URL}/rotas/', headers=headers)
rotas = response.json()

# Criar rota
data = {
    'nome': 'Nova Rota',
    'descricao': 'Teste'
}
response = requests.post(f'{BASE_URL}/rotas/', json=data, headers=headers)
nova_rota = response.json()

print(nova_rota['id'])
```

### Com Postman

1. Importar Collection: (adicionar arquivo JSON)
2. Configurar token em Authorization
3. Testar endpoints

---

## ❌ Códigos de Erro

| Código | Significado |
|--------|-----|
| 200 | OK |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Server Error |

---

## 📚 Exemplos de Resposta

### Erro 400
```json
{
  "name": ["Este campo é obrigatório."]
}
```

### Erro 401
```json
{
  "detail": "Authentication credentials were not provided."
}
```

### Erro 404
```json
{
  "detail": "Not found."
}
```

---

## 🔍 Filtros e Busca

### Por Status
```
GET /api/rotas/?status=em_andamento
```

### Por Data
```
GET /api/rotas/?data_entrega=2026-02-20
```

### Combinado
```
GET /api/rotas/?status=em_andamento&data_entrega=2026-02-20&page=1
```

---

## 📄 Paginação

Padrão: 50 itens por página

```json
{
  "count": 150,
  "next": "http://localhost:8000/api/rotas/?page=2",
  "previous": null,
  "results": [...]
}
```

Mudar tamanho da página em settings.py:
```python
REST_FRAMEWORK = {
    'PAGE_SIZE': 100
}
```

---

Para mais informações sobre integração, consulte [Django REST Framework Docs](https://www.django-rest-framework.org/)
