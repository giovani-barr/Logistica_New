# 🔥 Integração com Firebird Database

This document explains how to set up and use the Firebird integration in Fermap Logística.

## Table of Contents
1. [Installation](#installation)
2. [Configuration](#configuration)
3. [Creating SQL Queries](#creating-sql-queries)
4. [Importing Orders](#importing-orders)
5. [Converting Orders to Routes](#converting-orders-to-routes)
6. [Troubleshooting](#troubleshooting)

---

## Installation

The Firebird integration requires the `fdb` library. It's already included in `requirements.txt`.

If you need to install it manually:
```bash
pip install fdb cryptography
```

---

## Configuration

### Step 1: Set Up Connection

1. Go to **Mapa > Firebird > Configurar Conexão**
2. Fill in the connection details:
   - **Nome da Conexão**: Name for this connection
   - **Host/Servidor**: IP or hostname (e.g., `192.168.1.100` or `localhost`)
   - **Porta**: Usually `3050` (default)
   - **Caminho do Banco**: Full path to the database file
     - Windows: `C:\Firebird\database.fdb`
     - Linux: `/home/user/database.fdb`
   - **Usuário Firebird**: Usually `SYSDBA`
   - **Senha Firebird**: Database password
   - **Charset**: Usually `UTF8`

3. Click **Testar Conexão** to verify
4. Click **Salvar Configuração** to save

### Example Configuration

```
Nome: Database Principal
Host: 192.168.1.50
Porta: 3050
Caminho: C:\Firebird\SISTEMA.FDB
Usuário: SYSDBA
Senha: ****
Charset: UTF8
```

---

## Creating SQL Queries

### Step 2: Create Query

1. Go to **Mapa > Firebird > Queries**
2. Click **Nova Query**
3. Fill in:
   - **Nome da Query**: e.g., "Pedidos para Entrega"
   - **Descrição**: What this query does
   - **SQL Query**: Your SELECT statement

### SQL Query Example

```sql
SELECT 
    P.PEDIDO_ID as "PEDIDO",
    C.NOME as "CLIENTE",
    E.NOME as "ENTREGADOR",
    E.LATITUDE,
    E.LONGITUDE,
    P.DESCRICAO,
    E.ENDERECO,
    E.TELEFONE,
    E.EMAIL
FROM PEDIDOS P
INNER JOIN CLIENTES C ON P.CLIENTE_ID = C.ID
INNER JOIN ENDERECOS E ON P.ENDERECO_ID = E.ID
WHERE P.STATUS = 'PENDENTE'
    AND P.DATA_ENTREGA = CURRENT_DATE
```

### Field Mapping

You MUST specify the **exact column names** returned by your query:

- **Campo: Número do Pedido** ⭐: Column name for order number
- **Campo: Nome do Cliente** ⭐: Column name for customer name
- **Campo: Latitude** ⭐: Column name for latitude
- **Campo: Longitude** ⭐: Column name for longitude
- **Campo: Entregador** (optional): Column name for delivery person
- **Campo: Descrição** (optional): Column name for description
- **Campo: Endereço** (optional): Column name for address
- **Campo: Telefone** (optional): Column name for phone
- **Campo: Email** (optional): Column name for email

⭐ = Required fields

### Example Field Mapping

If your query returns:
```sql
SELECT 
    PEDIDO_NUM,      -- Your order number column
    CUSTOMER_NAME,   -- Your customer column
    DELIVERY_PERSON, -- Your deliverer column
    LAT_VALUE,       -- Your latitude column
    LON_VALUE,       -- Your longitude column
    NOTES,           -- Your description column
    ADDRESS,
    PHONE,
    EMAIL_CLIENT
FROM ...
```

Then map:
- Campo: Número do Pedido = `PEDIDO_NUM`
- Campo: Nome do Cliente = `CUSTOMER_NAME`
- Campo: Entregador = `DELIVERY_PERSON`
- Campo: Latitude = `LAT_VALUE`
- Campo: Longitude = `LON_VALUE`
- Campo: Descrição = `NOTES`
- Campo: Endereço = `ADDRESS`
- Campo: Telefone = `PHONE`
- Campo: Email = `EMAIL_CLIENT`

### Test Query

After creating, always test your query:
1. Click **Testar** on the query
2. A preview will show with up to 5 records
3. Verify the data looks correct

---

## Importing Orders

### Step 3: Import Orders

1. Go to **Mapa > Firebird > Importar Pedidos**
2. Select your query from the dropdown
3. Click **Importar Pedidos**
4. Wait for the import to complete

The system will:
- ✅ Connect to Firebird
- ✅ Execute your query
- ✅ Store orders locally
- ✅ Show import results

You'll see: "Importação concluída! X novos pedidos, Y atualizados."

---

## Converting Orders to Routes

### Step 4: Use Orders in Routes

1. Go to **Mapa > Firebird > Pedidos**
2. You'll see imported orders split into:
   - **Pendentes**: Not yet added to a route
   - **Importados**: Already added to routes
   - **Mapa**: Visual view of all locations

3. For each pending order, click **Usar nesta Rota**
4. Choose:
   - An existing route OR
   - Create a new route with a name
5. The order is converted to a stop (parada) on the map

The system will create:
- 📍 A new stop on your route with all order information
- 🗺️ Mark the location with coordinates
- 📋 Include order details (client, address, notes)

---

## How It Works

```
┌─────────────────────┐
│  Firebird Database  │
│  (Your data)        │
└──────────┬──────────┘
           │ SQL Query
           ▼
┌─────────────────────┐
│   Query Results     │
│  (Orders/Clients)   │
└──────────┬──────────┘
           │ Map fields
           ▼
┌─────────────────────┐
│ Local Storage       │
│ (PedidoFirebird)    │
└──────────┬──────────┘
           │ Convert
           ▼
┌─────────────────────┐
│  Route Stops        │
│  (Paradas on Map)   │
└─────────────────────┘
```

---

## Important Notes

### Latitude/Longitude Format

Must be valid coordinates:
- **Latitude**: -90.0 to +90.0  
- **Longitude**: -180.0 to +180.0

Example for São Paulo:
- Latitude: -23.5505
- Longitude: -46.6333

### Data Types

- Pedido/Cliente: Text (any length)
- Latitude/Longitude: Numbers (float/decimal)
- Entregador/Descrição: Text (optional)
- Endereço/Telefone/Email: Text (optional)

### Firebird Connection Issues

**Connection refused:**
- Check host and port are correct
- Verify Firebird server is running
- Check username/password

**Character encoding errors:**
- Use `UTF8` charset (most common)
- If data shows as `?????`, try `NONE` or `ISO8859_1`

**Timeout:**
- Check network connection to server
- Firebird server may be busy
- Try again or check server logs

---

## Troubleshooting

### "Connection Firebird realizada com sucesso!" but import fails

**Problem**: Connection works but import shows errors

**Solutions**:
1. Check your SQL query syntax in **Testar**
2. Verify all mapped column names exist in results
3. Ensure latitude/longitude are numeric, not NULL
4. Check for `None` or empty values in required fields

### Orders not showing on map

**Problem**: Imported orders but not visible

**Solutions**:
1. Check latitude/longitude values are valid
2. Ensure coordinates are in correct format (decimal)
3. Try zooming out on the map
4. Refresh the page

### "Mapeamento inválido" error

**Problem**: Field mapping error

**Solutions**:
1. Check column names are EXACT match (case-sensitive in some databases)
2. Run the test query to see actual column names
3. Update field mapping with correct names
4. Re-import after fixing query

### Duplicate orders on each import

**Problem**: Same orders appearing multiple times

**Solutions**:
1. Modify your query to add `WHERE` conditions
2. Use `ORDER BY PEDIDO_ID DESC LIMIT X` to limit imports
3. Clear old data and reimport
4. Use query filters to import only new orders

---

## API Reference

### Database Fields Stored

For each imported order, we store:
- `numero_pedido`: Order number
- `cliente_nome`: Customer name  
- `entregador`: Delivery person (optional)
- `latitude`: GPS latitude
- `longitude`: GPS longitude
- `descricao`: Order description (optional)
- `endereco`: Customer address (optional)
- `telefone`: Phone number (optional)
- `email`: Email address (optional)
- `dados_json`: Full original row data
- `importado`: Boolean (converted to route?)
- `rota`: Linked route object

### Django Admin

All imported data is visible in Django Admin:
- **Conexões Firebird**: Manage connections
- **Queries Firebird**: Manage SQL queries
- **Pedidos Firebird**: View imported orders

---

## Examples

### Example 1: Simple E-commerce Orders

```sql
SELECT 
    O.ORDER_ID as "PEDIDO",
    C.FULL_NAME as "CLIENTE",
    A.STREET || ', ' || A.NUMBER as "ENDERECO",
    A.LATITUDE,
    A.LONGITUDE,
    O.NOTES as "DESCRICAO",
    C.PHONE as "TELEFONE"
FROM ORDERS O
JOIN CUSTOMERS C ON O.CUSTOMER_ID = C.ID
JOIN ADDRESSES A ON C.ID = A.CUSTOMER_ID
WHERE O.STATUS = 'READY_FOR_DELIVERY'
```

### Example 2: Logistics with Drivers

```sql
SELECT 
    P.PED_NUM as "PEDIDO",
    E.EMPRESA_NOME as "CLIENTE",
    D.DRIVER_NAME as "ENTREGADOR",
    L.LAT,
    L.LON,
    P.PED_DESCR as "DESCRICAO",
    E.ENDERECO,
    E.TELEFONE,
    E.EMAIL
FROM PEDIDOS P
JOIN EMPRESAS E ON P.EMP_ID = E.EMP_ID
JOIN DRIVERS D ON P.DRIVER_ID = D.DRIVER_ID
JOIN LOCALIZACOES L ON P.LOC_ID = L.LOC_ID
WHERE P.STATUS = 1 -- Pending
```

### Example 3: With Date Filter

```sql
SELECT 
    P.NUMERO as "PEDIDO",
    C.NOME as "CLIENTE",
    C.NOME_VENDEDOR as "ENTREGADOR",
    C.LATITUDE,
    C.LONGITUDE,
    P.OBSERVACAO as "DESCRICAO",
    C.ENDERECO,
    C.TELEFONE,
    C.EMAIL
FROM TB_PEDIDOS P
JOIN TB_CLIENTES C ON P.ID_CLIENTE = C.ID_CLIENTE
WHERE P.DATA_PEDIDO = CURRENT_DATE
  AND P.STATUS IN ('NOVO', 'CONFIRMADO')
ORDER BY P.NUMERO
```

---

## Support

For issues or questions:
1. Check **Troubleshooting** section above
2. Test connection in settings
3. Verify query with test button
4. Check Django admin for data
5. Review server logs for Firebird errors

