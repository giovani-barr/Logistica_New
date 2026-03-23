# 🔥 Guia Rápido - Firebird Integration

Integração com Firebird Database para importar pedidos e clientes diretamente para o mapa.

## ⚡ 5 Passos Rápidos

### 1️⃣ Configurar Conexão
```
Menu: Mapa > Firebird (botão roxo) > Configurare Conexão

Preenchendo 👇
- Nome: "Banco Principal"
- Host: 192.168.1.100 (IP do servidor Firebird)
- Porta: 3050 (padrão)
- Caminho: C:\Firebird\database.fdb
- Usuário: SYSDBA
- Senha: ***
- Charset: UTF8

✅ Clique em "Testar Conexão"
✅ Clique em "Salvar Configuração"
```

### 2️⃣ Criar Query SQL
```
Menu: HOME (/) > Painel de Pedidos > ⚙ SQL + Card

Exemplo básico 👇
SELECT 
    NUMERO as "PEDIDO",
    CLIENTE as "CLIENTE",
    ENTREGADOR as "ENTREGADOR",
    LATITUDE,
    LONGITUDE,
    DESCRICAO,
    ENDERECO,
    TELEFONE,
    EMAIL
FROM PEDIDOS
WHERE STATUS = 'PENDENTE'

✅ Clique em "Testar" para preview
✅ Clique em "Salvar SQL"
✅ Selecione/ordene os campos do card e salve
```

### 3️⃣ Importar Pedidos
```
Menu: Rotas > Firebird > Importar

- Selecione a query ativa (SQL salvo no painel SQL + Card)
- Clique "Importar Pedidos"
- Aguarde a sincronização

Resultado: "X novos pedidos, Y atualizados"
```

### 4️⃣ Ver Pedidos no Mapa
```
Menu: Rotas > Firebird > Pedidos

Você verá:
- Pedidos Pendentes (Amarelo)
- Pedidos Importados (Verde)
- Mapa de Localizações
```

### 5️⃣ Adicionar à Rota
```
Clique "Usar nesta Rota"

Escolha:
- Uma rota existente
- OU crie uma nova rota

✅ O pedido vira parada no seu mapa!
```

---

## 📋 Checklist Pré-Requisitos

- [ ] Acesso ao servidor Firebird
- [ ] IP e porta do Firebird
- [ ] Usuário e senha
- [ ] Caminho do arquivo .fdb
- [ ] SQL da base de dados (saber nomes das colunas)

---

## 🚨 Erros Comuns

### "Connection refused"
→ Verifique IP, porta e se Firebird está ligado

### "Coluna não encontrada"
→ Verifique os nomes exatos das colunas na query
→ Use `SELECT * FROM TABELA LIMIT 1` para listar

### "Latitude/Longitude inválida"
→ Certifique-se que são números (não texto)
→ Formato: `-23.5505` (não `-23.55°05`)

### "Sem pedidos retornados"
→ Teste a query diretamente no Firebird
→ Verifique a cláusula WHERE
→ Limite a 100 registros para teste: `LIMIT 100`

---

## 📚 Exemplo SQL Completo

```sql
-- Para e-commerce
SELECT 
    O.ORDER_NUMBER as "PEDIDO",
    C.NAME as "CLIENTE",
    S.NAME as "ENTREGADOR",
    A.LATITUDE,
    A.LONGITUDE,
    O.NOTES as "DESCRICAO",
    A.STREET as "ENDERECO",
    C.PHONE as "TELEFONE",
    C.EMAIL
FROM 
    ORDERS O
    JOIN CUSTOMERS C ON O.CUSTOMER_ID = C.ID
    JOIN STAFF S ON O.ASSIGNED_TO = S.ID
    JOIN ADDRESSES A ON C.ADDRESS_ID = A.ID
WHERE 
    O.STATUS = 'READY_FOR_DELIVERY'
    AND O.DATE = CURRENT_DATE
ORDER BY 
    O.ORDER_NUMBER
```

---

## 🔄 Fluxo de Dados

```
┌──────────────────┐
│ Firebird Server  │  (Seu banco de dados)
└────────┬─────────┘
         │ Conecta
         ▼
┌──────────────────┐
│ SQL + Card (HOME)│  (Edita/Testa/Salva SQL)
└────────┬─────────┘
         │ Persistência técnica
         ▼
┌──────────────────┐
│  QueryFirebird   │  (Técnica/interna)
└────────┬─────────┘
         │ Executa
         ▼
┌──────────────────┐
│  PedidoFirebird  │  (Armazenado localmente)
└────────┬─────────┘
         │ Converte
         ▼
┌──────────────────┐
│  Parada (Rota)   │  (Aparece no Mapa!)
└──────────────────┘
```

---

## 📲 Menu Firebird

- **Configurare Conexão** - Conectar ao Firebird
- **Testar Conexão** - Validar acesso
- **Importar** - Sincronizar pedidos
- **Pedidos** - Ver e converter
- **Admin Django** - Gerenciar dados

---

## ✅ Próximos Passos

1. Configure a conexão com seu Firebird
2. No HOME, abra `SQL + Card` e configure o SQL
3. Teste o SQL e salve
4. Importe os pedidos
5. Converta pedidos em paradas no mapa
6. Otimize as rotas! ✨

---

## 💡 Pro Tips

- **Filtros**: Use `WHERE DATA = CURRENT_DATE` para pedidos de hoje
- **Limite**: Comece com `LIMIT 10` para testar
- **Performance**: Crie index nas colunas de busca
- **Schedule**: Cron para importar a cada 2 horas
- **Backup**: Exporte rotas como PDF antes de sincronizar

---

## 🆘 Suporte

Consulte o arquivo completo: `FIREBIRD_INTEGRATION.md`

