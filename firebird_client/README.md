# Cliente Firebird 2.5 - 64bit

## Download Rápido (Opção Recomendada)

**Baixe APENAS o fbclient.dll 64-bit do Firebird 2.5:**

### Link Direto:
https://github.com/FirebirdSQL/firebird/releases/download/R2_5_9/Firebird-2.5.9.27139-0_x64.zip

### Passos:
1. Baixe o arquivo ZIP acima
2. Extraia APENAS o arquivo `fbclient.dll` de dentro da pasta `bin`
3. Copie o `fbclient.dll` para esta pasta: `C:\Projetos\logistica_project\firebird_client\`
4. O arquivo final deve estar em: `C:\Projetos\logistica_project\firebird_client\fbclient.dll`

## Verificar

Após copiar, execute no terminal:
```powershell
C:/Projetos/logistica_project/venv/Scripts/python.exe -c "import os; print('✅ DLL encontrada!' if os.path.exists('firebird_client/fbclient.dll') else '❌ DLL não encontrada')"
```

## Por que isso não afeta seu sistema?

- Esta DLL fica APENAS na pasta do projeto
- Não interfere com seu Firebird 2.5 existente
- É compatível com servidores Firebird 2.5
- Não precisa instalar nada no Windows
- Seu sistema ECOSIS continua funcionando normalmente
