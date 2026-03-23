# Firebird Setup - Fluxo Atual (SQL + Card)

## Objetivo
Este documento descreve a configuração técnica da integração Firebird no estado atual do projeto, com foco no fluxo unificado **SQL + Card** no `index`.

---

## ✅ O que está implementado

### Modelos
- `ConexaoFirebird`: configurações de conexão por usuário
- `QueryFirebird`: persistência técnica da query principal
- `PedidoFirebird`: pedidos importados

### Funcionalidades
- Configurar e testar conexão Firebird
- Editar SQL principal no modal SQL+Card (index)
- Testar SQL com preview e tempo de execução
- Configurar campos visuais do card no mesmo modal
- Importar pedidos
- Converter pedido em parada no mapa

### Rotas ativas
| URL | Descrição |
|-----|-----------|
| `/rotas/firebird/conexao/` | Configurar conexão |
| `/rotas/firebird/conexao/test/` | Testar conexão (AJAX) |
| `/rotas/firebird/importar/` | Importar pedidos |
| `/rotas/firebird/pedidos/` | Listar pedidos importados |
| `/rotas/firebird/pedidos/<id>/converter/` | Converter pedido em parada |

> O CRUD público de queries em `/rotas/firebird/queries/...` foi removido da UX.

---

## 🚀 Setup rápido

1. Instale dependências:
```bash
pip install -r requirements.txt
```

2. Aplique migrações:
```bash
python manage.py migrate
```

3. Inicie o servidor:
```bash
python manage.py runserver
```

4. Fluxo recomendado:
- configurar conexão Firebird;
- abrir `index` e ajustar SQL+Card;
- importar pedidos;
- converter pedidos em paradas.

---

## Estrutura de dados (resumo)

### ConexaoFirebird
- `usuario`
- `nome_conexao`
- `host`
- `porta`
- `caminho_banco`
- `usuario_banco`
- `senha_banco`
- `charset`
- `ativo`, `testado`

### QueryFirebird (técnica)
- `usuario`
- `conexao`
- `nome_query`
- `descricao`
- `sql`
- campos de mapeamento usados internamente para importação

### PedidoFirebird
- `usuario`
- `query`
- `numero_pedido`
- `cliente_nome`
- `latitude`, `longitude`
- campos opcionais (`entregador`, `descricao`, `endereco`, `telefone`, `email`)
- `dados_json`
- `importado`, `rota`

---

## SQL e aliases

O sistema depende de aliases consistentes no SQL para mapear dados de pedido.

Exemplo:
```sql
SELECT
    PEDIDO_ID AS PEDIDO,
    CLIENTE_NOME AS CLIENTE,
    LATITUDE,
    LONGITUDE,
    ENDERECO,
    TELEFONE
FROM PEDIDOS
WHERE STATUS = 'PENDENTE'
```

Boas práticas:
- manter nomes de alias estáveis;
- validar no botão de teste antes de salvar;
- limitar volume em ambiente de desenvolvimento.

---

## Troubleshooting

### Connection refused
- verificar host/porta/firewall;
- testar conectividade até o servidor Firebird.

### Column not found
- revisar nomes de colunas no banco;
- ajustar aliases no SQL do modal.

### Charset/encoding
- testar `UTF8`, `NONE` ou `ISO8859_1` conforme o banco.

### Sem dados no preview
- revisar filtros `WHERE`;
- testar com consulta mais simples.

---

## Segurança

Para produção:
- usar variáveis de ambiente para credenciais;
- evitar expor senha em logs;
- restringir rede entre aplicação e Firebird;
- usar HTTPS.

---

## Observações de manutenção

- Alterações de UX devem priorizar o modal SQL+Card no `index`.
- `QueryFirebird` permanece como camada técnica interna.
- Evitar reintroduzir telas separadas de query sem necessidade de produto.
