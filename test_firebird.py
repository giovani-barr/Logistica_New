#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script de teste para verificar a configuração do cliente Firebird
"""
import os
import sys
from pathlib import Path

def verificar_configuracao():
    """Verifica se o cliente Firebird está configurado corretamente"""
    print("\n" + "="*60)
    print("  Verificação do Cliente Firebird")
    print("="*60 + "\n")
    
    # 1. Verifica versão do Python
    import platform
    print(f"✓ Python: {platform.python_version()} ({platform.architecture()[0]})")
    
    # 2. Verifica módulo fdb
    try:
        import fdb
        print(f"✓ Módulo fdb: {fdb.__version__}")
    except ImportError:
        print("✗ Módulo fdb não instalado")
        print("  Execute: pip install fdb==2.0.4")
        return False
    
    # 3. Verifica fbclient.dll do projeto
    base_dir = Path(__file__).parent
    dll_projeto = base_dir / 'firebird_client' / 'fbclient.dll'
    
    if dll_projeto.exists():
        tamanho = dll_projeto.stat().st_size
        tipo = "64-bit" if tamanho > 1_000_000 else "32-bit"
        print(f"✓ fbclient.dll (projeto): {tipo} - {tamanho:,} bytes")
        print(f"  Localização: {dll_projeto}")
        dll_usar = str(dll_projeto)
    else:
        print("⚠ fbclient.dll não encontrado na pasta do projeto")
        print(f"  Esperado em: {dll_projeto}")
        
        # Verifica DLLs do sistema
        dll_sistema = Path("C:/Windows/System32/fbclient.dll")
        if dll_sistema.exists():
            tamanho = dll_sistema.stat().st_size
            tipo = "64-bit" if tamanho > 1_000_000 else "32-bit"
            print(f"✓ fbclient.dll (sistema): {tipo} - {tamanho:,} bytes")
            dll_usar = str(dll_sistema)
            
            if tipo == "32-bit" and platform.architecture()[0] == "64bit":
                print("\n❌ PROBLEMA DETECTADO:")
                print("   Seu Python é 64-bit mas a DLL é 32-bit!")
                print("\n📥 SOLUÇÃO:")
                print("   Execute: .\\setup_firebird_client.ps1")
                print("   Ou baixe manualmente de:")
                print("   https://github.com/FirebirdSQL/firebird/releases/download/R2_5_9/Firebird-2.5.9.27139-0_x64.zip")
                return False
        else:
            print("✗ Nenhum fbclient.dll encontrado")
            return False
    
    # 4. Tenta carregar a API do Firebird
    print("\n🧪 Testando carregamento da DLL...")
    try:
        # Adiciona a pasta da DLL ao PATH
        if dll_projeto.exists():
            os.environ['PATH'] = str(dll_projeto.parent) + os.pathsep + os.environ.get('PATH', '')
        
        # Tenta carregar
        api = fdb.load_api(fb_library_name=dll_usar if 'dll_usar' in locals() else None)
        print(f"✓ API carregada com sucesso!")
        print(f"  Biblioteca: {api.get_firebird_library_name()}")
        
        print("\n" + "="*60)
        print("✅ TUDO PRONTO! O cliente Firebird está configurado.")
        print("="*60)
        print("\n📋 Próximos passos:")
        print("   1. Inicie o servidor: python manage.py runserver")
        print("   2. Acesse: http://localhost:8000/firebird/conexao/")
        print("   3. Configure e teste a conexão")
        print()
        return True
        
    except Exception as e:
        print(f"\n❌ Erro ao carregar a DLL:")
        print(f"   {e}")
        print("\n📥 Execute o script de configuração:")
        print("   .\\setup_firebird_client.ps1")
        return False

if __name__ == '__main__':
    sucesso = verificar_configuracao()
    sys.exit(0 if sucesso else 1)
