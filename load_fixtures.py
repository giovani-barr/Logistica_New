import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'logistica.settings')
django.setup()

from django.contrib.auth.models import User
from rotas.models import Rota, Parada

# Limpar dados existentes (comentar em produção)
# User.objects.all().delete()

# Criar usuário de demonstração
user, created = User.objects.get_or_create(
    username='demo',
    defaults={
        'email': 'demo@fermap.com',
        'first_name': 'Demo',
        'last_name': 'User',
        'is_staff': False
    }
)

if created:
    user.set_password('demo123')
    user.save()
    print(f"✅ Usuário demo criado com sucesso!")
else:
    print(f"ℹ️  Usuário demo já existe")

# Criar rotas de demonstração
rotas_demo = [
    {
        'nome': 'Rota Centro - Flores',
        'descricao': 'Entrega no centro e bairro Flores',
        'status': 'em_andamento'
    },
    {
        'nome': 'Rota Zona Leste',
        'descricao': 'Entregas na zona leste da cidade',
        'status': 'planejamento'
    },
    {
        'nome': 'Rota Zona Oeste - Finalizada',
        'descricao': 'Rota concluída na zona oeste',
        'status': 'concluída'
    }
]

for rota_data in rotas_demo:
    rota, created = Rota.objects.get_or_create(
        usuario=user,
        nome=rota_data['nome'],
        defaults={
            'descricao': rota_data['descricao'],
            'status': rota_data['status']
        }
    )
    
    if created:
        print(f"✅ Rota '{rota.nome}' criada!")
        
        # Adicionar paradas de demonstração
        paradas = [
            {
                'sequencia': 1,
                'cliente_nome': 'João Silva',
                'endereco': 'Rua das Flores, 123',
                'bairro': 'Centro',
                'cidade': 'Manaus',
                'cep': '69025-050',
                'latitude': -3.1190,
                'longitude': -60.0217,
                'tipo': 'entrega',
                'observacoes': 'Buzina 3 vezes'
            },
            {
                'sequencia': 2,
                'cliente_nome': 'Maria Santos',
                'endereco': 'Av. Getúlio Vargas, 456',
                'bairro': 'Flores',
                'cidade': 'Manaus',
                'cep': '69027-000',
                'latitude': -3.1150,
                'longitude': -60.0150,
                'tipo': 'entrega',
                'observacoes': 'Entregar no porteiro'
            },
            {
                'sequencia': 3,
                'cliente_nome': 'Pedro Costa',
                'endereco': 'Rua Nilo Peçanha, 789',
                'bairro': 'Cidade Nova',
                'cidade': 'Manaus',
                'cep': '69050-000',
                'latitude': -3.0950,
                'longitude': -60.0050,
                'tipo': 'coleta',
                'observacoes': 'Coletar na recepção'
            }
        ]
        
        for parada_data in paradas:
            Parada.objects.get_or_create(
                rota=rota,
                sequencia=parada_data['sequencia'],
                defaults=parada_data
            )
        
        print(f"   ✅ {len(paradas)} paradas adicionadas")
    else:
        print(f"ℹ️  Rota '{rota.nome}' já existe")

print("\n" + "="*50)
print("✨ Dados de demonstração carregados com sucesso!")
print("="*50)
print("\nCredenciais de Login:")
print("  Usuário: demo")
print("  Senha: demo123")
print("\nAcesse: http://localhost:8000")
