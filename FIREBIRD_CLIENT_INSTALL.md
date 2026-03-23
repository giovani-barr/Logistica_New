# Instalação do Cliente Firebird

## Problema: Erro WinError 193

Se você está recebendo o erro **"[WinError 193] %1 não é um aplicativo Win32 válido"**, isso significa que o cliente Firebird não está instalado corretamente ou não está acessível.

## Solução

### 1. Baixar o Cliente Firebird

Acesse: https://firebirdsql.org/en/firebird-3-0/

**IMPORTANTE**: Baixe a versão correta:
- Se seu Python é **64-bit** → Baixe Firebird **64-bit**
- Se seu Python é **32-bit** → Baixe Firebird **32-bit**

Para verificar qual versão do Python você tem:
```powershell
python -c "import platform; print(platform.architecture()[0])"
```

### 2. Instalar o Firebird

**Opção A - Instalação Completa (Recomendado)**
1. Execute o instalador do Firebird
2. Escolha "Full Installation" ou "Client Installation"
3. Durante a instalação, marque a opção para adicionar ao PATH
4. Reinicie o terminal/computador após a instalação

**Opção B - Apenas DLL (Para desenvolvedores)**
1. Baixe apenas o `fbclient.dll` da versão correta (64 ou 32 bits)
2. Coloque o arquivo em uma das pastas:
   - `C:\Windows\System32` (para 64-bit)
   - `C:\Windows\SysWOW64` (para 32-bit)
   - Ou na pasta do seu projeto

### 3. Verificar a Instalação

Após instalar, verifique se o Python consegue encontrar a DLL:

```python
import fdb
print(fdb.__version__)
print("Cliente Firebird instalado corretamente!")
```

### 4. Testar a Conexão

No sistema, vá para:
1. **Configuração Firebird** → http://localhost:8000/firebird/conexao/
2. Preencha os dados da conexão
3. Clique em **"Testar Conexão"**

## Configurações Comuns

### Localhost (mesmo computador)
- **Host**: `localhost` ou `127.0.0.1`
- **Porta**: `3050`
- **Caminho**: `C:\Firebird\database.fdb`
- **Usuário**: `SYSDBA`
- **Senha**: `masterkey` (padrão)

### Servidor Remoto
- **Host**: `192.168.1.100` (IP do servidor)
- **Porta**: `3050`
- **Caminho**: `C:\Firebird\database.fdb` ou caminho completo no servidor
- **Usuário**: `SYSDBA`
- **Senha**: (fornecida pelo administrador)

### Formato do Caminho do Banco

- **Windows local**: `C:\Firebird\database.fdb`
- **Windows remoto**: `C:\Firebird\database.fdb` (apenas o caminho no servidor)
- **Linux/Unix**: `/opt/firebird/database.fdb`

## Erros Comuns

### Erro 193 - DLL inválida
**Causa**: Versão errada do cliente (32-bit vs 64-bit)
**Solução**: Instale a versão correspondente ao seu Python

### Unable to complete network request
**Causa**: Servidor não está rodando ou não acessível
**Solução**: 
- Verifique se o servidor Firebird está ativo
- Verifique o firewall/rede

### Error while trying to open file
**Causa**: Caminho do banco incorreto
**Solução**: Verifique o caminho completo do arquivo .fdb

### User name and password not defined
**Causa**: Credenciais incorretas
**Solução**: Verifique usuário e senha do Firebird

## Suporte

Se continuar com problemas, verifique:
1. Versão do Python (32 ou 64 bits)
2. Versão do Firebird instalada
3. Logs do servidor Firebird
4. Firewall e permissões de rede
