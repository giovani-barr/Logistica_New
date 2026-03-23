# Mapeamento Extendido de Campos do Firebird

## O que foi adicionado

O sistema agora suporta mapear TODOS os campos do sua query SQL do Firebird! 

### ✅ Campos Adicionados ao Modelo QueryFirebird

#### 📋 Campos Obrigatórios
- ✓ Número do Pedido
- ✓ Nome do Cliente
- ✓ Latitude
- ✓ Longitude
- ✓ Endereço

#### 👤 Campos de Cliente (12 campos)
- Fantasia
- CPF/CNPJ
- RG/IE
- Telefone
- Celular
- Email
- Bairro
- Cidade
- Estado
- CEP
- Complemento
- Número do Endereço

#### 💳 Campos de Endereço de Cobrança (3 campos)
- Endereço de Cobrança
- Bairro de Cobrança
- Número de Cobrança

#### 🛒 Campos de Pedido (5 campos)
- Valor do Pedido
- Data do Pedido
- Data Previsão de Entrega
- Observação do Pedido
- Status do Pedido

#### 👔 Campos de Vendedor (2 campos)
- Código do Vendedor
- Nome do Vendedor

#### 🏢 Campos de Empresa (3 campos)
- Nome da Empresa
- CNPJ da Empresa
- Telefone da Empresa

#### 📦 Campos de Produto (4 campos)
- Código do Produto
- Descrição do Produto
- Quantidade
- Valor do Produto

### 📊 Total de Campos Mapeáveis
**34 campos** que podem ser mapeados + campo JSON para campos personalizados!

## Como Usar

### 1. Acesse a Criação de Query
```
http://localhost:8000/firebird/queries/criar/
```

### 2. Cole sua Query SQL
Cole o SQL completo no campo "SQL Query"

### 3. Mapeie os Campos
Use as **6 abas** para organizar o mapeamento:
- 🌟 **Obrigatórios** - Campos essenciais
- 👤 **Cliente** - Dados do cliente e endereço
- 🛒 **Pedido** - Informações do pedido
- 👔 **Vendedor** - Dados do vendedor
- 🏢 **Empresa** - Informações da empresa
- 📦 **Produto** - Dados dos produtos

### 4. Exemplo de Mapeamento

Para o SQL fornecido, você mapearia assim:

| Campo no Sistema | Coluna no SQL |
|------------------|---------------|
| Número do Pedido | `PEDIDO` |
| Nome do Cliente | `Nome cliente` |
| Latitude | `LATITUDE` |
| Longitude | `LONGITUDE` |
| Endereço | `Endereco cliente` |
| CPF/CNPJ | `CPFCNPJ cliente` |
| Telefone | `Fone cliente` |
| Bairro | `Bairro cliente` |
| Cidade | `Cidade cliente` |
| Valor do Pedido | `Valor pedido` |
| Data do Pedido | `Data venda` |
| Nome do Vendedor | `Nome vendedor` |
| Nome da Empresa | `Nome fantasia empresa` |
| Código do Produto | `codigo produto` |
| Quantidade | `quantidade vendido` |

### 5. Campos Opcionais

**Todos os campos exceto os 5 obrigatórios são opcionais!**

Você pode mapear apenas os que precisa. Os campos não mapeados simplesmente serão ignorados.

## Novidades no Template

### ✨ Interface com Abas
- Campos organizados em 6 categorias
- Interface limpa e intuitiva
- Badge "OBRIGATÓRIO" para campos essenciais
- Exemplos de nomes de colunas em cada campo

### 📱 Responsivo
- Layout adaptável para diferentes tamanhos de tela
- Sidebar com ajuda contextual
- Lista de campos disponíveis sempre visível

## Benefícios

### ✅ Flexibilidade Total
- Mapeie quantos campos quiser
- Sem limitação de campos
- Suporte para campos personalizados via JSON

### ✅ Dados Mais Ricos
- Capture mais informações do Firebird
- Disponibilize mais dados nas paradas
- Melhor rastreabilidade de pedidos

### ✅ Integração Completa
- Todos os dados do pedido disponíveis
- Informações de cliente completas
- Dados de produto e vendedor

## Migração Aplicada

```bash
python manage.py migrate rotas
```

A migração `0003_remove_queryfirebird_campo_descricao_and_more.py` foi aplicada com sucesso!

## Testes

### 1. Testar Conexão Firebird
```
http://localhost:8000/firebird/conexao/
```

### 2. Criar Nova Query
```
http://localhost:8000/firebird/queries/criar/
```

### 3. Testar Query
Após salvar, use o botão "Testar Query" para verificar se os dados são retornados corretamente.

### 4. Importar Pedidos
```
http://localhost:8000/firebird/importar/
```

## Próximos Passos

1. **Configure a conexão** com seu Firebird 2.5
2. **Crie uma query** mapeando os campos do seu SQL
3. **Teste a query** para validar os dados
4. **Importe os pedidos** para o sistema
5. **Converta para paradas** no mapa de rotas

## Suporte

Se precisar mapear campos adicionais não listados, use o campo JSON `mapeamento_adicional` que permite armazenar qualquer estrutura de dados personalizada.

---

**Sistema atualizado em:** 13/02/2026  
**Versão:** 2.0 - Mapeamento Extendido
