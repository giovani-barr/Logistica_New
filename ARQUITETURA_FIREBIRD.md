# 📚 Arquitetura Firebird - Índice Atual

Este guia organiza a documentação Firebird com base na arquitetura em produção: fluxo unificado **SQL + Card** no `index`.

---

## 🎯 Leitura por objetivo

### Começar rápido (5-10 min)
- `FIREBIRD_QUICKSTART.md`
- `README_FIREBIRD.md`

### Operar no dia a dia
- `FIREBIRD_COMPLETO.md`
- `FIREBIRD_SETUP.md`

### Exemplos de SQL
- `FIREBIRD_EXAMPLES.md`

### Contexto técnico completo
- `FIREBIRD_INTEGRATION.md`
- `MUDANCAS_RESUMO.md`

---

## 🧭 Arquitetura funcional

```text
ConexaoFirebird
   ↓
SQL do usuário no modal SQL+Card (index)
   ↓
QueryFirebird (persistência técnica)
   ↓
PedidoFirebird (importação)
   ↓
Conversão para Parada (mapa)
```

### Decisão de produto
- SQL e configuração visual de card ficam no mesmo modal.
- As telas públicas de CRUD de query foram removidas.
- O foco operacional está em: configurar conexão, ajustar SQL+Card, importar e rotear.

---

## 🌐 Rotas relevantes

- `/rotas/firebird/conexao/`
- `/rotas/firebird/conexao/test/`
- `/rotas/firebird/importar/`
- `/rotas/firebird/pedidos/`
- `/rotas/firebird/pedidos/<id>/converter/`

> Endpoints AJAX do `index` suportam salvar/testar SQL e salvar configuração de card.

---

## 🗂️ Arquivos-chave

### Backend
- `rotas/views.py` (endpoints SQL+Card e normalização de campos)
- `rotas/views_firebird.py` (conexão, importação e conversão)
- `rotas/models.py` (ConexaoFirebird, QueryFirebird, PedidoFirebird)
- `rotas/urls.py` (rotas ativas)

### Frontend
- `rotas/templates/rotas/index.html` (modal SQL+Card + painel pedidos)
- `rotas/static/js/app.js` (integrações do mapa/pedidos)

---

## ✅ Checklist de consistência

- [x] Fluxo principal documentado como SQL+Card
- [x] URLs antigas de `/queries/...` removidas da arquitetura
- [x] Camada `QueryFirebird` descrita como interna/técnica
- [x] Documentos principais apontando para o fluxo atual

---

## 📌 Próximo passo recomendado

Se for validar rapidamente o sistema após mudanças:
1. configurar conexão Firebird;
2. abrir modal SQL+Card no `index`;
3. testar e salvar SQL;
4. importar pedidos;
5. converter um pedido para parada no mapa.
