from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.core.serializers.json import DjangoJSONEncoder
import fdb
import json
import os
import platform
from pathlib import Path
from datetime import datetime, date, time
from decimal import Decimal

from .models import ConexaoFirebird, QueryFirebird, PedidoFirebird, Rota, Parada, ConfiguracaoUsuario
from .forms_firebird import ConexaoFirebirdForm, ImportarPedidosForm


def _json_safe(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    return value


def _resolve_firebird_client_library():
    env_lib = os.environ.get('FIREBIRD_CLIENT_LIB')
    if env_lib and Path(env_lib).exists():
        return env_lib

    project_root = Path(__file__).resolve().parents[1]
    local_lib = project_root / 'firebird_client' / 'fbclient.dll'
    if local_lib.exists():
        return str(local_lib)

    return None


def _connect_firebird_with_kwargs(host, port, database, user, password, charset):
    kwargs = {
        'host': host,
        'port': port,
        'database': database,
        'user': user,
        'password': password,
        'charset': charset,
    }
    client_lib = _resolve_firebird_client_library()
    if client_lib:
        kwargs['fb_library_name'] = client_lib
    return fdb.connect(**kwargs)


def _friendly_firebird_error(exc):
    message = str(exc)
    if 'WinError 193' in message:
        py_bits = platform.architecture()[0]
        return (
            f"Erro: {message}. Incompatibilidade de arquitetura detectada. "
            f"Seu Python é {py_bits}. Use um fbclient.dll da mesma arquitetura "
            f"(ex.: 64-bit com Python 64-bit). Coloque em firebird_client/fbclient.dll "
            f"ou defina a variável FIREBIRD_CLIENT_LIB."
        )
    return f'Erro: {message}'


def conectar_firebird(conexao):
    """Conecta ao banco Firebird"""
    try:
        connection = _connect_firebird_with_kwargs(
            host=conexao.host,
            port=conexao.porta,
            database=conexao.caminho_banco,
            user=conexao.usuario_banco,
            password=conexao.senha_banco,
            charset=conexao.charset,
        )
        return connection
    except Exception as e:
        raise Exception(_friendly_firebird_error(e))


def _importar_pedidos_core(usuario, conexao, query, max_resumo=50):
    """Executa a importação de pedidos e retorna contagem e resumo dos novos"""
    conn = conectar_firebird(conexao)
    cursor = conn.cursor()

    try:
        cursor.execute(query.sql)
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]

        campo_indices = {}
        campos_mapeados = {
            'numero_pedido': query.campo_pedido,
            'cliente_nome': query.campo_cliente,
            'entregador': query.campo_entregador,
            'latitude': query.campo_latitude,
            'longitude': query.campo_longitude,
            'descricao': query.campo_descricao,
            'endereco': query.campo_endereco,
            'telefone': query.campo_telefone,
            'email': query.campo_email,
        }

        for campo_django, campo_firebird in campos_mapeados.items():
            if campo_firebird and campo_firebird.upper() in [c.upper() for c in columns]:
                idx = next((i for i, c in enumerate(columns) if c.upper() == campo_firebird.upper()), None)
                if idx is not None:
                    campo_indices[campo_django] = idx

        pedidos_criados = 0
        pedidos_atualizados = 0
        novos_pedidos_resumo = []

        for row in rows:
            dados_json = _json_safe(dict(zip(columns, row)))

            numero_pedido = str(row[campo_indices.get('numero_pedido', 0)])
            cliente_nome = str(row[campo_indices.get('cliente_nome', 1)]) if 'cliente_nome' in campo_indices else 'N/A'

            latitude = None
            longitude = None
            try:
                if 'latitude' in campo_indices and row[campo_indices.get('latitude')] not in [None, '']:
                    latitude = float(str(row[campo_indices.get('latitude')]).replace(',', '.'))
                if 'longitude' in campo_indices and row[campo_indices.get('longitude')] not in [None, '']:
                    longitude = float(str(row[campo_indices.get('longitude')]).replace(',', '.'))
            except (ValueError, KeyError, TypeError):
                latitude = None
                longitude = None

            pedido, created = PedidoFirebird.objects.update_or_create(
                usuario=usuario,
                numero_pedido=numero_pedido,
                query=query,
                defaults={
                    'cliente_nome': cliente_nome,
                    'entregador': str(row[campo_indices['entregador']]) if 'entregador' in campo_indices else None,
                    'latitude': latitude,
                    'longitude': longitude,
                    'descricao': str(row[campo_indices['descricao']]) if 'descricao' in campo_indices else None,
                    'endereco': str(row[campo_indices['endereco']]) if 'endereco' in campo_indices else None,
                    'telefone': str(row[campo_indices['telefone']]) if 'telefone' in campo_indices else None,
                    'email': str(row[campo_indices['email']]) if 'email' in campo_indices else None,
                    'dados_json': dados_json
                }
            )

            if created:
                pedidos_criados += 1
                if len(novos_pedidos_resumo) < max_resumo:
                    novos_pedidos_resumo.append({
                        'id': pedido.id,
                        'numero_pedido': pedido.numero_pedido,
                        'cliente_nome': pedido.cliente_nome,
                        'endereco': pedido.endereco,
                    })
            else:
                pedidos_atualizados += 1

        return {
            'criados': pedidos_criados,
            'atualizados': pedidos_atualizados,
            'total_linhas': len(rows),
            'novos': novos_pedidos_resumo,
        }
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            conn.close()
        except Exception:
            pass


@login_required
def conexao_firebird_view(request):
    """Gerencia a conexão com Firebird"""
    try:
        conexao = request.user.conexao_firebird
        formulario = ConexaoFirebirdForm(request.POST or None, instance=conexao)
    except ConexaoFirebird.DoesNotExist:
        conexao = None
        formulario = ConexaoFirebirdForm(request.POST or None)
    
    if request.method == 'POST':
        if formulario.is_valid():
            conexao = formulario.save(commit=False)
            conexao.usuario = request.user
            conexao.save()
            messages.success(request, 'Conexão configurada com sucesso!')
            return redirect('rotas:conexao_firebird')
    
    context = {
        'formulario': formulario,
        'conexao': conexao,
        'conexao_testada': conexao.testado if conexao else False
    }
    return render(request, 'rotas/firebird_conexao.html', context)


@login_required
@require_http_methods(["POST"])
def test_conexao_firebird(request):
    """Testa a conexão com o banco Firebird"""
    try:
        payload = {}
        if request.body:
            try:
                payload = json.loads(request.body.decode('utf-8'))
            except Exception:
                payload = {}

        host = (payload.get('host') or '').strip()
        caminho_banco = (payload.get('caminho_banco') or '').strip()
        usuario_banco = (payload.get('usuario_banco') or '').strip()
        senha_banco = payload.get('senha_banco') or ''
        charset = (payload.get('charset') or 'UTF8').strip() or 'UTF8'
        porta_raw = payload.get('porta')

        if host and caminho_banco and usuario_banco and senha_banco:
            try:
                porta = int(porta_raw or 3050)
            except (TypeError, ValueError):
                porta = 3050
            conn = _connect_firebird_with_kwargs(
                host=host,
                port=porta,
                database=caminho_banco,
                user=usuario_banco,
                password=senha_banco,
                charset=charset,
            )
        else:
            conexao = request.user.conexao_firebird
            conn = conectar_firebird(conexao)

        cursor = conn.cursor()
        
        # Executa uma query simples para testar
        cursor.execute("SELECT 1 FROM RDB$DATABASE")
        cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        # Marca como testada quando já existe conexão salva
        try:
            conexao = request.user.conexao_firebird
            conexao.testado = True
            conexao.save(update_fields=['testado', 'data_modificacao'])
        except ConexaoFirebird.DoesNotExist:
            pass
        
        return JsonResponse({
            'success': True,
            'message': 'Conexão com Firebird realizada com sucesso!'
        })
    except ConexaoFirebird.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Nenhuma conexão configurada. Preencha e salve os dados da conexão primeiro.'
        }, status=400)
    except Exception as e:
        return JsonResponse({
            'success': False,
            'message': _friendly_firebird_error(e)
        }, status=400)


@login_required
def importar_pedidos(request):
    """Importa pedidos do Firebird"""
    try:
        conexao = request.user.conexao_firebird
    except ConexaoFirebird.DoesNotExist:
        messages.error(request, 'Configure a conexão com Firebird primeiro!')
        return redirect('rotas:conexao_firebird')
    
    dados_form = request.POST if request.method == 'POST' else None
    if request.method == 'GET':
        queries_ativas = QueryFirebird.objects.filter(usuario=request.user, ativo=True)
        if queries_ativas.count() == 1:
            dados_form = {'query': queries_ativas.first().pk}

    if dados_form is not None:
        formulario = ImportarPedidosForm(request.user, dados_form)
        if formulario.is_valid():
            query = formulario.cleaned_data['query']
            try:
                resultado = _importar_pedidos_core(request.user, conexao, query)
                messages.success(
                    request,
                    f"Importação concluída! {resultado['criados']} novos pedidos, {resultado['atualizados']} atualizados."
                )
                return redirect('rotas:pedidos_firebird_list')
            except Exception as e:
                messages.error(request, f'Erro ao importar: {_friendly_firebird_error(e)}')
    else:
        formulario = ImportarPedidosForm(request.user)
    
    context = {
        'formulario': formulario,
        'conexao': conexao
    }
    return render(request, 'rotas/firebird_importar.html', context)


@login_required
@require_http_methods(["POST"])
def importar_pedidos_async(request):
    """Importa pedidos do Firebird via AJAX/JSON"""
    try:
        conexao = request.user.conexao_firebird
    except ConexaoFirebird.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Configure a conexão com Firebird primeiro!'}, status=400)

    payload = {}
    if request.body:
        try:
            payload = json.loads(request.body.decode('utf-8'))
        except Exception:
            payload = {}

    query_id = payload.get('query_id') or payload.get('query')
    query = None
    if query_id:
        try:
            query = QueryFirebird.objects.get(pk=query_id, usuario=request.user, ativo=True)
        except QueryFirebird.DoesNotExist:
            return JsonResponse({'success': False, 'message': 'Query selecionada não encontrada ou inativa.'}, status=404)

    if not query:
        query = QueryFirebird.objects.filter(usuario=request.user, ativo=True).order_by('-data_modificacao').first()

    if not query:
        return JsonResponse({'success': False, 'message': 'Nenhuma query ativa encontrada. Configure em SQL + Card.'}, status=400)

    try:
        resultado = _importar_pedidos_core(request.user, conexao, query)
        total_importados = PedidoFirebird.objects.filter(usuario=request.user).count()
        message = f"Importação concluída: {resultado['criados']} novos, {resultado['atualizados']} atualizados."
        payload = {
            'success': True,
            'message': message,
            'criados': resultado['criados'],
            'atualizados': resultado['atualizados'],
            'total_linhas': resultado['total_linhas'],
            'total_importados': total_importados,
            'novos': resultado.get('novos', []),
        }
        return JsonResponse(_json_safe(payload), encoder=DjangoJSONEncoder)
    except Exception as e:
        return JsonResponse({'success': False, 'message': _friendly_firebird_error(e)}, status=400)


@login_required
def pedidos_firebird_list(request):
    """Lista os pedidos importados do Firebird"""
    pedidos = PedidoFirebird.objects.filter(usuario=request.user).order_by('-data_importacao')
    
    # Prepara dados para o template com filtro pendentes/importados
    pedidos_pendentes = pedidos.filter(importado=False)
    pedidos_importados = pedidos.filter(importado=True)
    
    context = {
        'pedidos': pedidos,
        'pendentes': pedidos_pendentes.count(),
        'importados': pedidos_importados.count(),
        'pedidos_json': json.dumps([
            {
                'lat': p.latitude,
                'lng': p.longitude,
                'title': f'{p.numero_pedido} - {p.cliente_nome}',
                'importado': p.importado
            }
            for p in pedidos
        ])
    }
    return render(request, 'rotas/firebird_pedidos.html', context)


@login_required
def converter_pedido_para_parada(request, pk):
    """Converte um pedido do Firebird para uma parada em uma rota"""
    pedido = get_object_or_404(PedidoFirebird, pk=pk, usuario=request.user)
    config, _ = ConfiguracaoUsuario.objects.get_or_create(usuario=request.user)

    latitude = pedido.latitude
    longitude = pedido.longitude
    observacao_extra = ''
    if latitude is None or longitude is None:
        if not config.permitir_pedidos_sem_coordenadas:
            if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return JsonResponse({'success': False, 'message': 'Pedido sem coordenadas. Habilite a opção nas configurações.'}, status=400)
            messages.error(request, 'Pedido sem coordenadas. Habilite a opção nas configurações para incluir na rota.')
            return redirect('rotas:pedidos_firebird_list')
        latitude = config.localizacao_padrao_lat
        longitude = config.localizacao_padrao_lng
        observacao_extra = ' [Sem coordenadas: adicionado no ponto padrão para ajuste manual]'
    
    # Obtém a rota ou cria uma nova
    rota_id = request.POST.get('rota_id')
    if rota_id:
        rota = get_object_or_404(Rota, pk=rota_id, usuario=request.user)
    else:
        # Cria uma nova rota
        rota_nome = request.POST.get('rota_nome', f'Rota {pedido.numero_pedido}')
        rota = Rota.objects.create(
            usuario=request.user,
            nome=rota_nome,
            descricao=f'Rota criada de {pedido.numero_pedido}'
        )
    
    # Encontra a próxima sequência
    proxima_sequencia = Parada.objects.filter(rota=rota).count() + 1
    
    # Cria a parada
    Parada.objects.create(
        rota=rota,
        sequencia=proxima_sequencia,
        cliente_nome=pedido.cliente_nome,
        endereco=pedido.endereco or 'N/A',
        latitude=latitude,
        longitude=longitude,
        tipo='entrega',
        observacoes=(pedido.descricao or '') + observacao_extra,
        cliente_telefone=pedido.telefone,
        cliente_email=pedido.email
    )
    
    # Marca como importado
    pedido.importado = True
    pedido.rota = rota
    pedido.save()
    
    messages.success(request, f'Pedido {pedido.numero_pedido} convertido para parada!')
    
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        return JsonResponse({'success': True, 'rota_id': rota.id})
    
    return redirect('rotas:pedidos_firebird_list')


@login_required
@require_http_methods(["POST"])
def atualizar_coordenadas_pedido(request, pk):
    """Atualiza coordenadas manualmente para um pedido Firebird"""
    pedido = get_object_or_404(PedidoFirebird, pk=pk, usuario=request.user)

    try:
        latitude = float(str(request.POST.get('latitude', '')).replace(',', '.'))
        longitude = float(str(request.POST.get('longitude', '')).replace(',', '.'))
    except (TypeError, ValueError):
        return JsonResponse({'success': False, 'message': 'Latitude/longitude inválidas.'}, status=400)

    pedido.latitude = latitude
    pedido.longitude = longitude
    pedido.save(update_fields=['latitude', 'longitude', 'data_modificacao'])

    return JsonResponse({'success': True, 'message': 'Coordenadas atualizadas com sucesso.'})


@login_required
@require_http_methods(["POST"])
def arquivar_pedido(request, pk):
    """Arquiva (soft-delete) ou restaura um pedido Firebird."""
    pedido = get_object_or_404(PedidoFirebird, pk=pk, usuario=request.user)

    try:
        import json as _json
        body = _json.loads(request.body or '{}')
    except ValueError:
        body = {}

    restaurar = body.get('restaurar', False)
    motivo = (body.get('motivo') or '').strip()

    if restaurar:
        pedido.arquivado = False
        pedido.motivo_arquivo = None
        pedido.save(update_fields=['arquivado', 'motivo_arquivo', 'data_modificacao'])
        return JsonResponse({'success': True, 'arquivado': False, 'message': 'Pedido restaurado com sucesso.'})
    else:
        pedido.arquivado = True
        pedido.motivo_arquivo = motivo or None
        pedido.save(update_fields=['arquivado', 'motivo_arquivo', 'data_modificacao'])
        return JsonResponse({'success': True, 'arquivado': True, 'message': 'Pedido arquivado com sucesso.'})


@login_required
@require_http_methods(["POST"])
def criar_rota_de_pedidos(request):
    """Cria/atualiza rota com múltiplos pedidos selecionados"""
    pedido_ids = request.POST.getlist('pedido_ids')
    rota_id = request.POST.get('rota_id')
    rota_nome = (request.POST.get('rota_nome') or '').strip()

    if not pedido_ids:
        messages.error(request, 'Selecione ao menos um pedido para montar a rota.')
        return redirect('rotas:montar_rota')

    pedidos = PedidoFirebird.objects.filter(usuario=request.user, importado=False, id__in=pedido_ids).order_by('id')
    if not pedidos.exists():
        messages.error(request, 'Nenhum pedido válido encontrado para montagem da rota.')
        return redirect('rotas:montar_rota')

    if rota_id:
        rota = get_object_or_404(Rota, pk=rota_id, usuario=request.user)
    else:
        if not rota_nome:
            rota_nome = f'Rota {datetime.now().strftime("%d/%m %H:%M")}'
        rota = Rota.objects.create(usuario=request.user, nome=rota_nome, descricao='Rota montada a partir de pedidos Firebird')

    config, _ = ConfiguracaoUsuario.objects.get_or_create(usuario=request.user)
    sequencia = Parada.objects.filter(rota=rota).count() + 1
    adicionados = 0
    ignorados = 0

    for pedido in pedidos:
        lat = pedido.latitude
        lng = pedido.longitude
        obs_extra = ''

        if lat is None or lng is None:
            if not config.permitir_pedidos_sem_coordenadas:
                ignorados += 1
                continue
            lat = config.localizacao_padrao_lat
            lng = config.localizacao_padrao_lng
            obs_extra = ' [Sem coordenadas: adicionado no ponto padrão para ajuste manual]'

        Parada.objects.create(
            rota=rota,
            sequencia=sequencia,
            cliente_nome=pedido.cliente_nome,
            endereco=pedido.endereco or 'N/A',
            latitude=lat,
            longitude=lng,
            tipo='entrega',
            observacoes=(pedido.descricao or '') + obs_extra,
            cliente_telefone=pedido.telefone,
            cliente_email=pedido.email,
        )
        sequencia += 1
        adicionados += 1

        pedido.importado = True
        pedido.rota = rota
        pedido.save(update_fields=['importado', 'rota', 'data_modificacao'])

    if adicionados:
        messages.success(request, f'Rota montada com sucesso! {adicionados} pedidos adicionados.')
    if ignorados:
        messages.warning(request, f'{ignorados} pedidos sem coordenadas foram ignorados (configuração atual).')

    return redirect('rotas:detalhe_rota', pk=rota.pk)
