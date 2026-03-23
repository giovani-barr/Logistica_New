# Firebird Integration - Exemplos de Configuração

## 🔧 Exemplos de SQL Queries

### Exemplo 1: E-commerce Simples

```sql
SELECT 
    O.NUMERO_PEDIDO as "PEDIDO",
    C.NOME_CLIENTE as "CLIENTE",
    E.NOME_VENDEDOR as "ENTREGADOR",
    E.LATITUDE,
    E.LONGITUDE,
    O.DESCRICAO_PEDIDO as "DESCRICAO",
    E.ENDERECO_COMPLETO as "ENDERECO",
    C.TELEFONE,
    C.EMAIL
FROM 
    TB_PEDIDOS O
    INNER JOIN TB_CLIENTES C ON O.ID_CLIENTE = C.ID_CLIENTE
    INNER JOIN TB_ENDERECOS E ON C.ID_ENDERECO = E.ID_ENDERECO
WHERE 
    O.STATUS = 'PENDENTE'
    AND O.DATA_PEDIDO = CURRENT_DATE
```

**Mapeamento:**
- Campo: Número Pedido = `PEDIDO`
- Campo: Nome Cliente = `CLIENTE`
- Campo: Entregador = `ENTREGADOR`
- Campo: Latitude = `LATITUDE`
- Campo: Longitude = `LONGITUDE`
- Campo: Descrição = `DESCRICAO`
- Campo: Endereço = `ENDERECO`
- Campo: Telefone = `TELEFONE`
- Campo: Email = `EMAIL`

---

### Exemplo 2: Logística com Múltiplos Status

```sql
SELECT 
    P.PED_NUMERO as "PEDIDO",
    C.CLI_NOME as "CLIENTE",
    D.MOT_NOME as "ENTREGADOR",
    L.LOC_LATITUDE as "LATITUDE",
    L.LOC_LONGITUDE as "LONGITUDE",
    P.PED_OBSERVACAO as "DESCRICAO",
    C.CLI_ENDERECO as "ENDERECO",
    C.CLI_TELEFONE as "TELEFONE",
    C.CLI_EMAIL as "EMAIL"
FROM 
    PEDIDOS P
    JOIN CLIENTES C ON P.PED_CLI_ID = C.CLI_ID
    LEFT JOIN MOTORISTAS D ON P.PED_MOT_ID = D.MOT_ID
    JOIN LOCALIZACOES L ON C.CLI_LOC_ID = L.LOC_ID
WHERE 
    P.PED_STATUS IN (1, 2)  -- 1=Novo, 2=Confirmado
    AND P.PED_DATA_CRIACAO >= DATEADD(day, -1, CAST(CURRENT_DATE AS TIMESTAMP))
ORDER BY 
    P.PED_NUMERO
```

---

### Exemplo 3: Apenas Pedidos de Hoje com Zona Geográfica

```sql
SELECT 
    NF.NUM_NOTA as "PEDIDO",
    CLI.RAZAO_SOCIAL as "CLIENTE",
    USU.NOME as "ENTREGADOR",
    LOC.LATITUDE,
    LOC.LONGITUDE,
    NF.OBSERVACOES as "DESCRICAO",
    END.RUA || ', ' || END.NUMERO || ' - ' || END.BAIRRO as "ENDERECO",
    CLI.TELEFONE,
    CLI.EMAIL
FROM 
    NOTAS_FISCAIS NF
    JOIN CLIENTES CLI ON NF.ID_CLIENTE = CLI.ID_CLIENTE
    JOIN ENDERECOS END ON CLI.ID_ENDERECO = END.ID_ENDERECO
    LEFT JOIN USUARIOS USU ON NF.ID_VENDEDOR = USU.ID_USUARIO
    JOIN LOCALIZACOES LOC ON END.ID_ENDERECO = LOC.ID_ENDERECO
WHERE 
    CAST(NF.DATA_EMISSAO AS DATE) = CURRENT_DATE
    AND NF.STATUS = 'A'  -- Ativo
    AND LOC.LATITUDE BETWEEN -24.0 AND -23.0  -- Zona permitida
    AND LOC.LONGITUDE BETWEEN -47.0 AND -46.0
```

---

### Exemplo 4: Com JOIN em Múltiplas Tabelas

```sql
SELECT 
    PED.ID as "PEDIDO",
    EMP.NOME_EMPRESA as "CLIENTE",
    COL.NOME_COLETOR as "ENTREGADOR",
    PAR.LATITUDE,
    PAR.LONGITUDE,
    PED.DESCRICAO_CARGA as "DESCRICAO",
    PAR.ENDERECO_PARADA,
    EMP.TELEFONE,
    EMP.EMAIL
FROM 
    PEDIDOS PED
    INNER JOIN EMPRESAS EMP ON PED.EMPRESA_ID = EMP.ID
    INNER JOIN PARADAS PAR ON PED.PARADA_ID = PAR.ID
    LEFT OUTER JOIN COLETORES COL ON PED.COLETOR_ID = COL.ID
WHERE 
    PED.DATA_AGENDAMENTO = CURRENT_DATE
    AND PED.SITUACAO = 'AGENDADO'
    AND PAR.LATITUDE IS NOT NULL
    AND PAR.LONGITUDE IS NOT NULL
ORDER BY 
    PAR.SEQUENCIA
```

---

### Exemplo 5: Union de Dois Tipos de Pedido

```sql
-- Entregas
SELECT 
    'ENTREGA' || '-' || E.NUM_ENTREGA as "PEDIDO",
    C.NOME as "CLIENTE",
    E.ENTREGADOR as "ENTREGADOR",
    E.LAT,
    E.LON,
    E.DESCRICAO,
    E.ENDERECO,
    C.TELEFONE,
    C.EMAIL
FROM ENTREGAS E
JOIN CLIENTES C ON E.CLI_ID = C.ID
WHERE E.STATUS = 'PENDENTE'

UNION ALL

-- Coletas
SELECT 
    'COLETA' || '-' || C.NUM_COLETA as "PEDIDO",
    E.NOME_EMPRESA as "CLIENTE",
    C.MOTORISTA as "ENTREGADOR",
    E.LATITUDE,
    E.LONGITUDE,
    C.OBSERVACAO as "DESCRICAO",
    E.ENDERECO,
    E.TELEFONE,
    E.EMAIL
FROM COLETAS C
JOIN EMPRESAS E ON C.EMP_ID = E.ID
WHERE C.STATUS = 'AGENDADA'
```

---

## 🎯 Configuração de Conexão - Exemplos

### Windows com Firebird Local
```
Nome Conexão: Local Development
Host: localhost
Porta: 3050
Caminho: C:\Program Files\Firebird\database.fdb
Usuário: SYSDBA
Senha: masterkey
Charset: UTF8
```

### Linux com Servidor Remoto
```
Nome Conexão: Production Server
Host: 192.168.1.100
Porta: 3050
Caminho: /opt/firebird/data/database.fdb
Usuário: SYSDBA
Senha: producao123
Charset: UTF8
```

### Docker Container
```
Nome Conexão: Docker Firebird
Host: firebird-container
Porta: 3050
Caminho: /var/lib/firebird/data/database.fdb
Usuário: sysdba
Senha: docker_password
Charset: UTF8
```

---

## 🔍 Troubleshooting SQL

### Problema: "Table not found"
```sql
-- Verificar tabelas disponíveis
SELECT RDB$RELATION_NAME 
FROM RDB$RELATIONS 
WHERE RDB$SYSTEM_FLAG = 0

-- Seu resultado deve incluir suas tabelas
```

### Problema: "Column not found"
```sql
-- Verificar colunas de uma tabela
SELECT RDB$FIELD_NAME 
FROM RDB$RELATION_FIELDS 
WHERE RDB$RELATION_NAME = 'PEDIDOS'
```

### Problema: "Invalid numeric value"
```sql
-- Converter para número se necessário
SELECT 
    CAST(LATITUDE AS NUMERIC(10,7)) as "LATITUDE",
    CAST(LONGITUDE AS NUMERIC(10,7)) as "LONGITUDE"
FROM ENDERECOS
```

### Problema: "NULL values"
```sql
-- Filtrar NULLs
SELECT 
    PEDIDO,
    CLIENTE,
    LATITUDE,
    LONGITUDE
FROM PEDIDOS
WHERE LATITUDE IS NOT NULL
  AND LONGITUDE IS NOT NULL
```

---

## 📋 Checklist para Testar Query

1. **Execute no Firebird SQL Executor:**
   ```sql
   SELECT * FROM PEDIDOS LIMIT 1
   ```
   ✅ Retorna dados?

2. **Verifique tipos de dados:**
   ```sql
   SELECT 
       CAST(LATITUDE AS VARCHAR(50)) as LAT_TYPE,
       CAST(LONGITUDE AS VARCHAR(50)) as LON_TYPE
   FROM PEDIDOS LIMIT 1
   ```
   ✅ São números?

3. **Valide joins:**
   ```sql
   SELECT 
       COUNT(*) as TOTAL,
       COUNT(DISTINCT PEDIDO_ID) as PEDIDOS
   FROM PEDIDOS P
   JOIN CLIENTES C ON P.CLI_ID = C.ID
   ```
   ✅ Retorna >0?

4. **Teste mapeamento:**
   ```sql
   -- Use os EXATOS nomes que você colocou em "Campo: ..."
   SELECT 
       PEDIDO,
       CLIENTE,
       LATITUDE,
       LONGITUDE
   FROM SEU_RESULTADO_AQUI
   LIMIT 5
   ```
   ✅ Retorna 5 linhas?

---

## 🚀 Performance Tips

### Para Grande Volume
```sql
-- Adicione índices
CREATE INDEX IDX_PEDIDOS_STATUS ON PEDIDOS(STATUS);
CREATE INDEX IDX_PEDIDOS_DATA ON PEDIDOS(DATA_CRIACAO);

-- Use LIMIT em desenvolvimento
SELECT ... FROM PEDIDOS LIMIT 100

-- Selecione apenas campos necessários
SELECT 
    PEDIDO,
    CLIENTE,
    LATITUDE,
    LONGITUDE
FROM PEDIDOS
-- Não faça SELECT *
```

### Scheduling
```bash
# Executar a cada 2 horas (em crontab Linux)
0 */2 * * * cd /home/user/logistica && ./venv/bin/python manage.py importar_firebird

# Windows Task Scheduler
# Executar: C:\Projetos\logistica_project\venv\Scripts\python.exe manage.py importar_firebird
# A cada 2 horas
```

---

## 💾 Backup e Restauração

### Exportar Query SQL
1. Vá para Django Admin
2. Selecione a query em "Queries Firebird"
3. Copie o SQL
4. Salve em arquivo `.sql`

### Backup de Pedidos Importados
```python
# manage.py shell
from rotas.models import PedidoFirebird
import json

pedidos = PedidoFirebird.objects.all().values()
with open('backup_pedidos.json', 'w') as f:
    json.dump(list(pedidos), f, indent=2, default=str)
```

---

## 🎓 Template Query Pronta para Copiar

```sql
SELECT 
    P.NUMERO as "PEDIDO",
    C.NOME as "CLIENTE",
    C.VENDEDOR as "ENTREGADOR",
    C.LATITUDE,
    C.LONGITUDE,
    P.OBSERVACAO as "DESCRICAO",
    C.ENDERECO,
    C.TELEFONE,
    C.EMAIL
FROM 
    PEDIDOS P
    INNER JOIN CLIENTES C ON P.CLIENTE_ID = C.ID
WHERE 
    P.STATUS = 'PENDENTE'
    AND P.DATA >= CURRENT_DATE - 1
    AND C.LATITUDE IS NOT NULL
    AND C.LONGITUDE IS NOT NULL
ORDER BY 
    P.NUMERO DESC
LIMIT 50
```

Copie e adapte seus nomes de tabelas e colunas!

