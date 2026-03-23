# Programas e extensoes necessarios

Guia simples para quem esta comecando do zero.

## Checklist rapido (ordem recomendada)

1. Instalar Python
2. Instalar Node.js
3. Instalar Git
4. Instalar extensoes do VS Code
5. Rodar INSTALAR.bat
6. Rodar iniciar.bat

## Programas obrigatorios

1. Python 3.10 ou superior
- Download oficial: https://www.python.org/downloads/
- Durante a instalacao no Windows, marque Add Python to PATH
- Verificar no terminal: python --version

2. Node.js LTS (inclui npm)
- Download oficial: https://nodejs.org/
- Recomendado: versao LTS
- Verificar no terminal: node --version

3. Git
- Download oficial: https://git-scm.com/downloads
- Verificar no terminal: git --version

4. Firebird Client (somente se usar integracao Firebird)
- Download oficial: https://firebirdsql.org/en/firebird-3-0/
- Importante: mesma arquitetura do Python
- Exemplo: Python 64-bit com Firebird 64-bit

## Programas opcionais

1. PostgreSQL
- Download oficial: https://www.postgresql.org/download/
- Opcional, pois o projeto funciona com SQLite por padrao

2. DBeaver (cliente SQL)
- Download oficial: https://dbeaver.io/download/
- Opcional, util para explorar banco visualmente

## Extensoes recomendadas no VS Code

1. Python (Microsoft)
- Marketplace: https://marketplace.visualstudio.com/items?itemName=ms-python.python

2. Pylance (Microsoft)
- Marketplace: https://marketplace.visualstudio.com/items?itemName=ms-python.vscode-pylance

3. ESLint (Microsoft)
- Marketplace: https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint
- Recomendado para o frontend React/Vite

4. Prettier - Code formatter
- Marketplace: https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode
- Opcional para formatar codigo automaticamente

## Como instalar o projeto (modo facil)

1. No explorador de arquivos, abra a pasta do projeto
2. Clique duas vezes em INSTALAR.bat
3. Acompanhe as pausas e mensagens de OK/ERRO
4. Depois clique duas vezes em iniciar.bat
5. Abra no navegador: http://localhost:8000

## Frontend Raio-X (se precisar recompilar)

1. Abrir terminal na pasta raio-x-app
2. Executar:
- npm.cmd install
- npm.cmd run build

Observacao: no PowerShell, se npm der erro de permissao de script, use sempre npm.cmd.

## Erros comuns e como resolver

1. python nao reconhecido
- Reinstale o Python e marque Add Python to PATH
- Feche e abra o VS Code

2. node ou npm nao reconhecido
- Reinstale Node.js LTS
- Feche e abra o VS Code

3. erro de npm.ps1 bloqueado no PowerShell
- Use npm.cmd install e npm.cmd run build

4. No module named django
- Rode INSTALAR.bat novamente
- Confirme que existe a pasta .venv no projeto

5. localhost recusou conexao
- Verifique se o servidor foi iniciado pelo iniciar.bat
- Confira se a janela do terminal continua aberta
