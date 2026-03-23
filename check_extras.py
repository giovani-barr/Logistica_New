import os, sys, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'logistica.settings'
sys.path.insert(0, r'c:\Projetos\logistica_project')
django.setup()
from django.conf import settings
settings.ALLOWED_HOSTS += ['testserver']

import json
from django.test import Client
from django.contrib.auth import get_user_model

User = get_user_model()
u = User.objects.filter(username='demo').first() or User.objects.first()
print(f'Usuario: {u.username}')

c = Client(enforce_csrf_checks=False)
c.force_login(u)

r = c.get('/firebird/raio-x/abas/')
data = json.loads(r.content)
for aba in data.get('abas', []):
    nome = aba['nome']
    aid = aba['id']
    sqls_extras = aba.get('sqls_extras', [])
    campos_join = aba.get('campos_join', [])
    print(f'\nABA id={aid} nome={nome!r}')
    print(f'  sql_extra_id={aba["sql_extra_id"]}  campos_join={json.dumps(campos_join)}')
    for ex in sqls_extras:
        print(f'  EXTRA id_local={ex.get("id_local")} titulo={ex.get("titulo")!r}')
        print(f'    sql_extra_id={ex.get("sql_extra_id")}')
        print(f'    campos_join={json.dumps(ex.get("campos_join", []))}')
        print(f'    grafico_config={json.dumps(ex.get("grafico_config", {}))}')

# Tentar executar um extra diretamente
from rotas.models import RaioXAba, PedidoFirebird
pedidos = PedidoFirebird.objects.filter(usuario=u).order_by('-id')[:1]
if pedidos:
    pedido = pedidos[0]
    print(f'\nPedido para teste: id={pedido.id} numero={pedido.numero_pedido!r}')
    
    # Executar o SQL extra via endpoint
    for aba in RaioXAba.objects.filter(usuario=u):
        for ex in (aba.sqls_extras or []):
            if ex.get('sql_extra_id'):
                payload = json.dumps({
                    'sql_extra_id': ex['sql_extra_id'],
                    'pedido_id': pedido.id,
                    'numero_pedido': pedido.numero_pedido,
                    'campos_join': ex.get('campos_join', []),
                })
                resp = c.post('/firebird/raio-x/executar/', payload, content_type='application/json')
                result = json.loads(resp.content)
                print(f'\n  Executando extra sql_id={ex["sql_extra_id"]} status={resp.status_code}')
                print(f'  success={result.get("success")} count={result.get("count")} msg={result.get("message")}')
                if result.get('data'):
                    print(f'  Primeira linha: {json.dumps(result["data"][0])[:500]}')
                elif result.get('message'):
                    print(f'  Erro/msg: {result.get("message")}')
