from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponse, StreamingHttpResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import ensure_csrf_cookie
from django.contrib import messages
from rotas.models import Rota, Parada, ConfiguracaoUsuario, PedidoFirebird, QueryFirebird, ConexaoFirebird, TemplatePdf, SqlExtra, ConfiguracaoGlobal, HistoricoExclusaoPedido, RaioXAba, NomeFixoRota
from .views_firebird import conectar_firebird
import json
import csv
import re
import time
from django.conf import settings
from django.db import transaction
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from reportlab.lib.units import inch
from decimal import Decimal
from datetime import datetime, date, time as dt_time, timedelta
from django.utils import timezone


DEFAULT_CAMPOS = [
    {'campo': 'numero_pedido', 'rotulo': 'Pedido', 'icone': '🧾', 'cor': '', 'tamanho': '', 'posicao': 'esquerda', 'largura': '', 'altura': ''},
    {'campo': 'cliente_nome', 'rotulo': 'Cliente', 'icone': '👤', 'cor': '', 'tamanho': '', 'posicao': 'esquerda', 'largura': '', 'altura': ''},
    {'campo': 'endereco', 'rotulo': 'Endereço', 'icone': '📍', 'cor': '', 'tamanho': '', 'posicao': 'esquerda', 'largura': '', 'altura': ''},
    {'campo': 'telefone', 'rotulo': 'Telefone', 'icone': '📞', 'cor': '', 'tamanho': '', 'posicao': 'esquerda', 'largura': '', 'altura': ''},
]


def _normalizar_nome_fixo_rota(nome):
    return re.sub(r'\s+', ' ', str(nome or '')).strip()


def _normalize_campos_busca_endereco(raw_value, campos_disponiveis=None):
    campos_validos = []
    for item in (raw_value or []):
        campo = str(item or '').strip()
        if not campo or campo in campos_validos:
            continue
        campos_validos.append(campo)

    if campos_disponiveis:
        mapa_disponiveis = {str(campo).strip().lower(): str(campo).strip() for campo in campos_disponiveis if str(campo).strip()}
        campos_filtrados = []
        for campo in campos_validos:
            canonico = mapa_disponiveis.get(campo.lower())
            if canonico and canonico not in campos_filtrados:
                campos_filtrados.append(canonico)
        return campos_filtrados

    return campos_validos

_GOOGLE_MAPS_PLACEHOLDER_KEYS = frozenset({
    'your_google_maps_api_key',
    'your_api_key',
    'your-api-key',
    'insert_your_key_here',
})

def _resolve_google_maps_key(user_config=None):
    config_key = ''
    if user_config is not None:
        config_key = str(getattr(user_config, 'google_maps_api_key', '') or '').strip()
    if config_key and config_key.lower() not in _GOOGLE_MAPS_PLACEHOLDER_KEYS:
        return config_key
    global_key = str(getattr(settings, 'GOOGLE_MAPS_API_KEY', '') or '').strip()
    if global_key and global_key.lower() not in _GOOGLE_MAPS_PLACEHOLDER_KEYS:
        return global_key
    return ''

def _normalize_google_maps_country(value):
    country = str(value or '').strip().lower()
    if not country:
        return 'br'
    return country[:10]

SQL_CAMPOS_DISPONIVEIS = [
    'Codigo cliente',
    'Cliente nome',
    'RGIE cliente',
    'CPFCNPJ cliente',
    'Fone cliente',
    'Email cliente',
    'Endereco cliente',
    'Numero endereco cliente',
    'Complemento cliente',
    'Bairro cliente',
    'Cidade cliente',
    'Estado cliente',
    'CEP cliente',
    'Fone celular',
    'Fone Fax',
    'Endereco cobranca',
    'Complemento cobranca',
    'Numero endereco cobranca',
    'Bairro cobranca',
    'Regiao',
    'Cod Cond Pagamento',
    'Descricao cond pagamento',
    'Codigo vendedor',
    'Nome vendedor',
    'LATITUDE',
    'LONGITUDE',
    'Pedido',
    'Valor entrada',
    'Valor pedido',
    'Nome comprador',
    'Endereco entrega',
    'Observacao cliente',
    'Data venda',
    'Data efetivado',
    'Hora efetivado',
    'Data saida',
    'Hora saida',
    'Peso liquido pedido',
    'Peso bruto pedido',
    'Observacao venda',
    'Total em atraso',
    'Total a vencer',
    'Total geral em aberto',
    'Qtd parcelas vencidas',
    'Dias medio atraso',
    'Faixa risco',
]


def _json_safe(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date, dt_time)):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    return value


def _normalize_campos_config(raw_value):
    if not isinstance(raw_value, list) or not raw_value:
        return DEFAULT_CAMPOS.copy()

    normalized = []
    for item in raw_value:
        if isinstance(item, str):
            campo = item.strip()
            if not campo:
                continue
            normalized.append({'campo': campo, 'rotulo': campo, 'icone': '', 'cor': '', 'tamanho': '', 'posicao': 'esquerda', 'largura': '', 'altura': ''})
            continue

        if isinstance(item, dict):
            campo = str(item.get('campo', '')).strip()
            if not campo:
                continue
            normalized.append({
                'campo': campo,
                'rotulo': str(item.get('rotulo', campo)).strip() or campo,
                'icone': str(item.get('icone', '')).strip(),
                'cor': str(item.get('cor', '')).strip(),
                'tamanho': str(item.get('tamanho', '')).strip(),
                'posicao': str(item.get('posicao', 'esquerda')).strip() or 'esquerda',
                'largura': str(item.get('largura', '')).strip(),
                'altura': str(item.get('altura', '')).strip(),
            })

    return normalized or DEFAULT_CAMPOS.copy()


def _campos_texto_from_config(campos_config):
    return ', '.join([item.get('campo', '') for item in campos_config if item.get('campo')])


def _normalize_regras_cor_config(raw_value):
    if not isinstance(raw_value, list):
        return []

    operadores_validos = {
        'igual',
        'diferente',
        'contem',
        'nao_contem',
        'maior',
        'maior_igual',
        'menor',
        'menor_igual',
        'vazio',
        'nao_vazio',
        # operadores temporais
        'dias_maior',
        'dias_menor',
        'dias_igual',
        'hoje',
        'horas_maior',
        'horas_menor',
        'dias_entre',
    }

    normalized = []
    for item in raw_value:
        if not isinstance(item, dict):
            continue

        campo = str(item.get('campo', '')).strip()
        operador = str(item.get('operador', 'igual')).strip().lower()
        valor = str(item.get('valor', '')).strip()
        valor2 = str(item.get('valor2', '')).strip()
        cor_fundo = str(item.get('cor_fundo', '')).strip()
        cor_borda = str(item.get('cor_borda', '')).strip()
        cor_texto = str(item.get('cor_texto', '')).strip()
        espessura_borda_raw = item.get('espessura_borda', '')
        try:
            espessura_borda = int(espessura_borda_raw) if espessura_borda_raw not in ('', None) else ''
            if espessura_borda != '' and (espessura_borda < 0 or espessura_borda > 20):
                espessura_borda = ''
        except (TypeError, ValueError):
            espessura_borda = ''
        ativo = bool(item.get('ativo', True))

        if not campo:
            continue
        if operador not in operadores_validos:
            operador = 'igual'

        prioridade_raw = item.get('prioridade', len(normalized) + 1)
        try:
            prioridade = int(prioridade_raw)
        except (TypeError, ValueError):
            prioridade = len(normalized) + 1

        normalized.append({
            'campo': campo,
            'operador': operador,
            'valor': valor,
            'valor2': valor2,
            'cor_fundo': cor_fundo,
            'cor_borda': cor_borda,
            'cor_texto': cor_texto,
            'espessura_borda': espessura_borda,
            'prioridade': max(1, prioridade),
            'ativo': ativo,
        })

    normalized.sort(key=lambda x: (x.get('prioridade') or 9999, x.get('campo') or ''))
    return normalized


def _parse_date_flexible(val_str):
    """Tenta converter string em date usando formatos comuns. Retorna None se falhar."""
    for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%Y/%m/%d', '%d/%m/%y'):
        try:
            return datetime.strptime(str(val_str).strip()[:10], fmt).date()
        except (ValueError, TypeError):
            continue
    return None


def _parse_datetime_flexible(val_str):
    """Tenta converter string em datetime. Tenta formatos com hora; cai para date se necessário."""
    s = str(val_str).strip()
    for fmt in ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%dT%H:%M',
                '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M'):
        try:
            return datetime.strptime(s, fmt)
        except (ValueError, TypeError):
            continue
    # Fallback: parse só a data e retornar meia-noite
    d = _parse_date_flexible(val_str)
    if d is not None:
        return datetime(d.year, d.month, d.day)
    return None


_OPERADORES_TEMPORAIS = frozenset({
    'dias_maior', 'dias_menor', 'dias_igual', 'hoje',
    'horas_maior', 'horas_menor', 'dias_entre',
})


def _apply_temporal_operator(operador, valor_ref, valor2_ref, val_str):
    """Avalia operadores temporais comparando val_str (data do campo) com hoje/agora.

    Retorna True/False. Retorna False em caso de parse inválido.
    """
    if operador in ('horas_maior', 'horas_menor'):
        dt_campo = _parse_datetime_flexible(val_str)
        if dt_campo is None:
            return False
        diff_horas = (datetime.now() - dt_campo).total_seconds() / 3600
        try:
            ref = float(str(valor_ref).replace(',', '.'))
        except (ValueError, TypeError):
            return False
        if operador == 'horas_maior':
            return diff_horas > ref
        return diff_horas < ref

    # Operadores baseados em dias
    data_campo = _parse_date_flexible(val_str)
    if data_campo is None:
        return False
    diff_dias = (date.today() - data_campo).days

    if operador == 'hoje':
        return diff_dias == 0

    try:
        ref_int = int(float(str(valor_ref).replace(',', '.')))
    except (ValueError, TypeError):
        return False

    if operador == 'dias_maior':
        return diff_dias > ref_int
    if operador == 'dias_menor':
        return diff_dias < ref_int
    if operador == 'dias_igual':
        return diff_dias == ref_int
    if operador == 'dias_entre':
        try:
            ref2_int = int(float(str(valor2_ref).replace(',', '.')))
        except (ValueError, TypeError):
            return False
        return ref_int <= diff_dias <= ref2_int

    return False


def _pedido_match_arquivamento(regra, pedido_obj, dados):
    """Retorna True se o pedido deve ser arquivado pela regra."""
    campo = str(regra.get('campo', '')).strip()
    operador = str(regra.get('operador', 'igual')).strip().lower()
    valor_ref = str(regra.get('valor', '')).strip().lower()

    if not campo:
        return False

    campos_modelo = {
        'numero_pedido': pedido_obj.numero_pedido,
        'cliente_nome': pedido_obj.cliente_nome,
        'entregador': pedido_obj.entregador,
        'endereco': getattr(pedido_obj, 'endereco', None),
        'telefone': getattr(pedido_obj, 'telefone', None),
        'email': getattr(pedido_obj, 'email', None),
        'descricao': getattr(pedido_obj, 'descricao', None),
        'data_importacao': pedido_obj.data_importacao.date() if pedido_obj.data_importacao else None,
    }
    val = campos_modelo.get(campo, dados.get(campo))
    val_str = str(val).strip().lower() if val is not None else ''

    if operador in ('ha_mais_de', 'ha_menos_de'):
        try:
            dias = int(float(valor_ref.replace(',', '.')))
        except (ValueError, TypeError):
            return False
        # Tenta obter a data: primeiro do valor do campo, depois como date diretamente
        if isinstance(val, date):
            data_pedido = val
        else:
            data_pedido = _parse_date_flexible(val_str)
        if data_pedido is None:
            return False
        hoje = date.today()
        diff = (hoje - data_pedido).days
        if operador == 'ha_mais_de':
            return diff > dias
        else:
            return diff < dias

    if operador in _OPERADORES_TEMPORAIS:
        return _apply_temporal_operator(operador, valor_ref, regra.get('valor2', ''), val_str)

    if operador == 'igual':
        return val_str == valor_ref
    elif operador == 'diferente':
        return val_str != valor_ref
    elif operador == 'contem':
        return valor_ref in val_str
    elif operador == 'nao_contem':
        return valor_ref not in val_str
    elif operador == 'vazio':
        return val is None or val_str == ''
    elif operador == 'nao_vazio':
        return val is not None and val_str != ''
    elif operador in ('maior', 'maior_igual', 'menor', 'menor_igual'):
        try:
            val_num = float(val_str.replace(',', '.'))
            ref_num = float(valor_ref.replace(',', '.'))
            if operador == 'maior':
                return val_num > ref_num
            elif operador == 'maior_igual':
                return val_num >= ref_num
            elif operador == 'menor':
                return val_num < ref_num
            else:
                return val_num <= ref_num
        except (ValueError, TypeError):
            return False
    return False


def _executar_arquivamento_global(cfg_global):
    """Executa as regras de arquivamento em todos os pedidos não arquivados.
    Preserva data_arquivamento e dias_quarentena_arquivo por grupo de prazo.
    Retorna a contagem arquivada."""
    regras = [r for r in (cfg_global.regras_arquivamento_pedidos or [])
              if isinstance(r, dict) and r.get('ativo', True)]
    if not regras:
        return 0

    agora = timezone.now()
    # {dias_quarentena_ou_None: [ids]}
    grupos = {}
    for pedido in PedidoFirebird.objects.filter(arquivado=False).iterator():
        dados = pedido.dados_json or {}
        regras_que_casaram = [r for r in regras if _pedido_match_arquivamento(r, pedido, dados)]
        if not regras_que_casaram:
            continue
        # Calcular prazo de quarentena: qualquer regra com 0 ou ausente -> None (protegido)
        protegido = False
        prazos = []
        for r in regras_que_casaram:
            try:
                dq = int(r.get('dias_quarentena', 0))
            except (ValueError, TypeError):
                dq = 0
            if dq <= 0:
                protegido = True
                break
            prazos.append(dq)
        dias_q = None if protegido else (min(prazos) if prazos else None)
        grupos.setdefault(dias_q, []).append(pedido.pk)

    if not grupos:
        return 0

    total = 0
    for dias_q, ids in grupos.items():
        PedidoFirebird.objects.filter(pk__in=ids).update(
            arquivado=True,
            data_arquivamento=agora,
            dias_quarentena_arquivo=dias_q,
        )
        total += len(ids)
    return total


def _executar_quarentena_global():
    """Exclui pedidos arquivados que passaram do prazo de quarentena.
    Salva cópia completa em HistoricoExclusaoPedido antes de excluir.
    Retorna contagem de excluídos."""
    agora = timezone.now()
    # Valores únicos de dias_quarentena_arquivo em uso
    valores = list(
        PedidoFirebird.objects
        .filter(arquivado=True, dias_quarentena_arquivo__isnull=False)
        .values_list('dias_quarentena_arquivo', flat=True)
        .distinct()
    )
    total_excluidos = 0
    for dias in valores:
        if not dias or dias <= 0:
            continue
        limite = agora - timedelta(days=dias)
        qs = PedidoFirebird.objects.filter(
            arquivado=True,
            dias_quarentena_arquivo=dias,
            data_arquivamento__lte=limite,
        )
        historicos = [
            HistoricoExclusaoPedido(
                numero_pedido=p.numero_pedido,
                cliente_nome=p.cliente_nome,
                entregador=p.entregador,
                endereco=p.endereco,
                dados_json=p.dados_json or {},
                data_importacao=p.data_importacao,
                data_arquivamento=p.data_arquivamento,
                dias_quarentena=p.dias_quarentena_arquivo,
            )
            for p in qs.iterator()
        ]
        if historicos:
            HistoricoExclusaoPedido.objects.bulk_create(historicos)
            qs.delete()
            total_excluidos += len(historicos)
    return total_excluidos


def _pedido_match_exclusao(regra, pedido_obj, dados):
    """Retorna True se o pedido corresponde à regra de exclusão (deve ser excluído)."""
    campo = str(regra.get('campo', '')).strip()
    operador = str(regra.get('operador', 'igual')).strip().lower()
    valor_ref = str(regra.get('valor', '')).strip().lower()

    if not campo:
        return False

    # Primeiro tenta campos diretos do modelo, depois dados_json
    campos_modelo = {
        'numero_pedido': pedido_obj.numero_pedido,
        'cliente_nome': pedido_obj.cliente_nome,
        'entregador': pedido_obj.entregador,
        'endereco': getattr(pedido_obj, 'endereco', None),
        'telefone': getattr(pedido_obj, 'telefone', None),
        'email': getattr(pedido_obj, 'email', None),
        'descricao': getattr(pedido_obj, 'descricao', None),
    }
    val = campos_modelo.get(campo, dados.get(campo))
    val_str = str(val).strip().lower() if val is not None else ''

    if operador in _OPERADORES_TEMPORAIS:
        return _apply_temporal_operator(operador, valor_ref, regra.get('valor2', ''), val_str)

    if operador == 'igual':
        return val_str == valor_ref
    elif operador == 'diferente':
        return val_str != valor_ref
    elif operador == 'contem':
        return valor_ref in val_str
    elif operador == 'nao_contem':
        return valor_ref not in val_str
    elif operador == 'vazio':
        return val is None or val_str == ''
    elif operador == 'nao_vazio':
        return val is not None and val_str != ''
    elif operador in ('maior', 'maior_igual', 'menor', 'menor_igual'):
        try:
            val_num = float(val_str.replace(',', '.'))
            ref_num = float(valor_ref.replace(',', '.'))
            if operador == 'maior':
                return val_num > ref_num
            elif operador == 'maior_igual':
                return val_num >= ref_num
            elif operador == 'menor':
                return val_num < ref_num
            else:
                return val_num <= ref_num
        except (ValueError, TypeError):
            return False
    return False


def _extract_sql_aliases(sql_text):
    if not sql_text:
        return []

    aliases = []
    for quoted in re.findall(r'\bAS\s+"([^"]+)"', sql_text, flags=re.IGNORECASE):
        alias = str(quoted).strip()
        if alias:
            aliases.append(alias)

    for plain in re.findall(r'\bAS\s+([A-Za-z_][A-Za-z0-9_]*)', sql_text, flags=re.IGNORECASE):
        alias = str(plain).strip()
        if alias:
            aliases.append(alias)

    unique = []
    seen = set()
    for item in aliases:
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    return unique


def _pick_alias(aliases, candidates):
    alias_map = {str(alias).strip().lower(): str(alias).strip() for alias in aliases if str(alias).strip()}
    for item in candidates:
        found = alias_map.get(item.lower())
        if found:
            return found
    return None


def _build_mapping_from_aliases(aliases):
    mapping = {
        'campo_pedido': _pick_alias(aliases, ['Pedido', 'PEDIDO', 'numero_pedido', 'Número do Pedido']),
        'campo_cliente': _pick_alias(aliases, ['Cliente nome', 'CLIENTE', 'cliente_nome', 'Nome cliente']),
        'campo_entregador': _pick_alias(aliases, ['Nome vendedor', 'Entregador', 'ENTREGADOR']),
        'campo_latitude': _pick_alias(aliases, ['LATITUDE', 'latitude', 'lat']),
        'campo_longitude': _pick_alias(aliases, ['LONGITUDE', 'longitude', 'lng', 'lon']),
        'campo_descricao': _pick_alias(aliases, ['Observacao cliente', 'Observacao venda', 'descricao', 'Descrição']),
        'campo_endereco': _pick_alias(aliases, ['Endereco entrega', 'Endereco cliente', 'endereco']),
        'campo_telefone': _pick_alias(aliases, ['Fone cliente', 'Fone celular', 'telefone']),
        'campo_email': _pick_alias(aliases, ['Email cliente', 'email']),
    }
    return mapping


def _default_mapping_fields():
    return {
        'campo_pedido': 'Pedido',
        'campo_cliente': 'Cliente nome',
        'campo_entregador': 'Nome vendedor',
        'campo_latitude': 'LATITUDE',
        'campo_longitude': 'LONGITUDE',
        'campo_descricao': 'Observacao cliente',
        'campo_endereco': 'Endereco entrega',
        'campo_telefone': 'Fone cliente',
        'campo_email': 'Email cliente',
    }


def _get_or_create_query_tecnica(user, sql=''):
    query = QueryFirebird.objects.filter(usuario=user, ativo=True).order_by('-data_modificacao').first()
    if query:
        return query, False

    conexao = ConexaoFirebird.objects.filter(usuario=user, ativo=True).first()
    if not conexao:
        raise ValueError('Configure uma conexão Firebird ativa antes de salvar o SQL.')

    payload = {
        'usuario': user,
        'conexao': conexao,
        'nome_query': 'SQL Cards (Principal)',
        'descricao': 'Query técnica gerada a partir do editor SQL + Card do painel.',
        'sql': sql,
        'ativo': True,
    }
    payload.update(_default_mapping_fields())

    query = QueryFirebird.objects.create(**payload)
    return query, True


@login_required
@ensure_csrf_cookie
def index(request):
    """Página inicial com o mapa interativo"""
    config, _ = ConfiguracaoUsuario.objects.get_or_create(usuario=request.user)
    
    # Se permitir pedido em múltiplas rotas, mostrar todos; senão, apenas não importados
    # Pedidos arquivados são sempre incluídos (o frontend decide quando exibir)
    if config.permitir_pedido_multiplas_rotas:
        pedidos_qs = PedidoFirebird.objects.filter(usuario=request.user).order_by('-data_importacao')[:500]
    else:
        pedidos_qs = PedidoFirebird.objects.filter(usuario=request.user, importado=False).order_by('-data_importacao')[:500]

    # Filtrar rotas ocultas configuradas pelo usuário
    rotas_ocultas_set = set(str(r).strip().lower() for r in (config.rotas_ocultas or []) if r)
    filtros_excl = [r for r in (config.filtros_exclusao_pedidos or []) if isinstance(r, dict) and r.get('ativo', True)]

    # Arquivamento automático + quarentena
    cfg_global = ConfiguracaoGlobal.get_instance()
    agora = timezone.now()

    regras_arq_ativas = [r for r in (cfg_global.regras_arquivamento_pedidos or []) if isinstance(r, dict) and r.get('ativo', True)]
    if regras_arq_ativas:
        ultima = cfg_global.ultima_execucao_arquivamento
        intervalo_h = cfg_global.intervalo_arquivamento_horas or 24
        if ultima is None or (agora - ultima).total_seconds() >= intervalo_h * 3600:
            _executar_arquivamento_global(cfg_global)
            cfg_global.ultima_execucao_arquivamento = agora
            cfg_global.save(update_fields=['ultima_execucao_arquivamento'])

    # Quarentena: exclui pedidos arquivados que venceram o prazo (timer independente)
    ultima_q = cfg_global.ultima_execucao_quarentena
    intervalo_q = cfg_global.intervalo_quarentena_horas or 24
    if ultima_q is None or (agora - ultima_q).total_seconds() >= intervalo_q * 3600:
        _executar_quarentena_global()
        cfg_global.ultima_execucao_quarentena = agora
        cfg_global.save(update_fields=['ultima_execucao_quarentena'])
    
    campos_exibicao = _normalize_campos_config(config.campos_exibicao_pedidos or [])
    query_ativa = QueryFirebird.objects.filter(usuario=request.user, ativo=True).order_by('-data_modificacao').first()
    sql_ativo = query_ativa.sql if query_ativa else ''
    campos_sql_extraidos = _extract_sql_aliases(sql_ativo)
    campos_sql = campos_sql_extraidos or SQL_CAMPOS_DISPONIVEIS

    auto_import_config = {
        'habilitado': False,
        'intervalo': 120,
        'query_id': query_ativa.id if query_ativa else None,
    }

    try:
        conexao_usuario = request.user.conexao_firebird
        auto_import_config.update({
            'habilitado': bool(conexao_usuario.importacao_automatica),
            'intervalo': conexao_usuario.importacao_intervalo_segundos,
        })
    except ConexaoFirebird.DoesNotExist:
        pass

    pedidos_index = []
    for pedido in pedidos_qs:
        # Determinar a rota do pedido (mesmo critério do frontend getRotaPedido)
        dados = pedido.dados_json or {}
        rota_pedido = next(
            (str(v).strip() for v in [
                pedido.entregador,
                dados.get('Rota'), dados.get('rota'),
                dados.get('Regiao'), dados.get('REGIAO'), dados.get('regiao'),
                dados.get('Nome vendedor'), dados.get('NOME VENDEDOR'), dados.get('nome vendedor'),
                dados.get('Entregador'), dados.get('ENTREGADOR'),
            ] if v is not None and str(v).strip() != ''),
            'Sem rota'
        )
        if rotas_ocultas_set and rota_pedido.lower() in rotas_ocultas_set:
            continue
        if filtros_excl and any(_pedido_match_exclusao(r, pedido, dados) for r in filtros_excl):
            continue
        # Calcular dias restantes de quarentena (para badge nos cards arquivados)
        dias_para_expirar = None
        if pedido.arquivado and pedido.data_arquivamento and pedido.dias_quarentena_arquivo:
            limite = pedido.data_arquivamento + timedelta(days=pedido.dias_quarentena_arquivo)
            diff = (limite - agora).days
            dias_para_expirar = max(0, diff)
        pedidos_index.append({
            'id': pedido.id,
            'numero_pedido': pedido.numero_pedido,
            'cliente_nome': pedido.cliente_nome,
            'entregador': pedido.entregador,
            'endereco': pedido.endereco,
            'telefone': pedido.telefone,
            'email': pedido.email,
            'descricao': pedido.descricao,
            'latitude': pedido.latitude,
            'longitude': pedido.longitude,
            'dados_json': _json_safe(pedido.dados_json or {}),
            'arquivado': pedido.arquivado,
            'data_arquivamento': pedido.data_arquivamento.strftime('%d/%m/%Y %H:%M') if pedido.data_arquivamento else None,
            'dias_para_expirar': dias_para_expirar,
        })

    context = {
        'config': config,
        'rotas': Rota.objects.filter(usuario=request.user, ativo=True),
        'google_maps_key': _resolve_google_maps_key(config),
        'google_maps_search_country': _normalize_google_maps_country(config.google_maps_search_country),
        'pedidos_index': pedidos_index,
        'campos_exibicao_pedidos': campos_exibicao,
        'campos_exibicao_rotas': _normalize_campos_config(config.campos_exibicao_rotas or []),
        'campos_sql_disponiveis': campos_sql,
        'sql_ativo_firebird': sql_ativo,
        'regras_cor_pedidos': _normalize_regras_cor_config(config.pedidos_card_regras_cor or []),
        'regras_cor_rotas': _normalize_regras_cor_config(config.rotas_card_regras_cor or []),
        'query_ativa_id': query_ativa.id if query_ativa else None,
        'total_pedidos': len(pedidos_index),
        'permitir_pedido_multiplas_rotas': config.permitir_pedido_multiplas_rotas,
        'auto_import_config': auto_import_config,
        'otimizacao_motor': config.otimizacao_motor or 'local',
        'rotas_ocultas': list(config.rotas_ocultas or []),
        'campos_busca_endereco': _normalize_campos_busca_endereco(cfg_global.campos_busca_endereco, campos_sql),
    }
    return render(request, 'rotas/index.html', context)


@login_required
def lista_rotas(request):
    """Lista todas as rotas do usuário"""
    rotas = Rota.objects.filter(usuario=request.user, ativo=True).order_by('-data_criacao')
    status_filter = request.GET.get('status')
    
    if status_filter:
        rotas = rotas.filter(status=status_filter)
    
    context = {
        'rotas': rotas,
        'status_filter': status_filter,
        'status_choices': Rota.STATUS_CHOICES
    }
    return render(request, 'rotas/lista_rotas.html', context)


@login_required
def detalhe_rota(request, pk):
    """Detalhe de uma rota específica"""
    rota = get_object_or_404(Rota, pk=pk, usuario=request.user)
    paradas = rota.paradas.all().order_by('sequencia')
    
    context = {
        'rota': rota,
        'paradas': paradas,
        'num_paradas': paradas.count()
    }
    return render(request, 'rotas/detalhe_rota.html', context)


@login_required
def editar_rota(request, pk):
    """Editar uma rota"""
    rota = get_object_or_404(Rota, pk=pk, usuario=request.user)
    
    if request.method == 'POST':
        rota.nome = request.POST.get('nome', rota.nome)
        rota.descricao = request.POST.get('descricao', '')
        rota.status = request.POST.get('status', rota.status)
        rota.observacoes = request.POST.get('observacoes', '')
        rota.save()
        return redirect('detalhe_rota', pk=pk)
    
    context = {'rota': rota, 'status_choices': Rota.STATUS_CHOICES}
    return render(request, 'rotas/editar_rota.html', context)


@login_required
def criar_rota(request):
    """Criar uma nova rota"""
    if request.method == 'POST':
        nome = request.POST.get('nome')
        descricao = request.POST.get('descricao', '')
        
        if nome:
            rota = Rota.objects.create(
                usuario=request.user,
                nome=nome,
                descricao=descricao
            )
            return redirect('rotas:detalhe_rota', pk=rota.pk)
    
    return render(request, 'rotas/criar_rota.html')


@login_required
@require_POST
def deletar_rota(request, pk):
    """Deletar uma rota"""
    rota = get_object_or_404(Rota, pk=pk, usuario=request.user)
    nome_rota = rota.nome
    
    # Liberar pedidos Firebird vinculados à rota
    PedidoFirebird.objects.filter(rota=rota).update(rota=None, importado=False)
    
    rota.ativo = False
    rota.save()
    messages.success(request, f'Rota "{nome_rota}" deletada com sucesso!')
    return redirect('rotas:lista_rotas')


@login_required
def reabrir_rota(request, pk):
    """Reabrir uma rota no mapa para edição"""
    rota = get_object_or_404(Rota, pk=pk, usuario=request.user)
    
    # Buscar pedidos Firebird relacionados à rota
    pedidos_firebird = PedidoFirebird.objects.filter(rota=rota).select_related('query')
    
    pedidos_dict = {p.cliente_nome: p for p in pedidos_firebird}
    
    # Serializar paradas da rota
    paradas_data = []
    for parada in rota.paradas.all().order_by('sequencia'):
        # Tentar encontrar o pedido Firebird correspondente
        pedido = pedidos_dict.get(parada.cliente_nome)
        
        parada_obj = {
            'lat': float(parada.latitude) if parada.latitude else None,
            'lng': float(parada.longitude) if parada.longitude else None,
            'cliente': parada.cliente_nome,
            'endereco': parada.endereco,
            'telefone': parada.cliente_telefone or '',
            'email': parada.cliente_email or '',
            'observacoes': parada.observacoes or '',
            'tempo_estimado': parada.tempo_estimado or 0,
            'tipo': parada.tipo,
        }
        
        # Se houver pedido Firebird correspondente, incluir os dados completos
        if pedido:
            parada_obj['pedidoData'] = {
                'id': pedido.id,
                'numero_pedido': pedido.numero_pedido,
                'cliente_nome': pedido.cliente_nome,
                'entregador': pedido.entregador,
                'endereco': pedido.endereco,
                'telefone': pedido.telefone,
                'email': pedido.email,
                'descricao': pedido.descricao,
                'dados_json': pedido.dados_json or {},
            }
            parada_obj['sourcePedidoId'] = pedido.id
        
        paradas_data.append(parada_obj)
    
    # Serializar dados da rota
    rota_data = {
        'id': rota.id,
        'nome': rota.nome,
        'descricao': rota.descricao or '',
        'paradas': paradas_data,
    }
    
    # Redirecionar para página inicial com os dados
    import json
    from urllib.parse import quote
    rota_json = quote(json.dumps(rota_data))
    return redirect(f'/?rota_data={rota_json}')


@login_required
def configuracao_usuario(request):
    """Página de configurações do usuário"""
    config, _ = ConfiguracaoUsuario.objects.get_or_create(usuario=request.user)
    
    if request.method == 'POST':
        config.nome_empresa = request.POST.get('nome_empresa', config.nome_empresa)
        config.telefone_empresa = request.POST.get('telefone_empresa', '')
        config.email_empresa = request.POST.get('email_empresa', '')
        config.usar_otimizacao_automatica = 'usar_otimizacao_automatica' in request.POST
        config.permitir_compartilhamento = 'permitir_compartilhamento' in request.POST
        def _parse_float(value, fallback):
            try:
                if value is None or str(value).strip() == '':
                    return fallback
                # Aceita vírgula como separador decimal (pt-BR)
                return float(str(value).strip().replace(',', '.'))
            except (ValueError, TypeError):
                return fallback

        config.localizacao_padrao_lat = _parse_float(request.POST.get('localizacao_padrao_lat', ''), config.localizacao_padrao_lat)
        config.localizacao_padrao_lng = _parse_float(request.POST.get('localizacao_padrao_lng', ''), config.localizacao_padrao_lng)
        config.ponto_partida_lat = _parse_float(request.POST.get('ponto_partida_lat', ''), config.ponto_partida_lat)
        config.ponto_partida_lng = _parse_float(request.POST.get('ponto_partida_lng', ''), config.ponto_partida_lng)
        config.ponto_final_lat = _parse_float(request.POST.get('ponto_final_lat', ''), config.ponto_final_lat)
        config.ponto_final_lng = _parse_float(request.POST.get('ponto_final_lng', ''), config.ponto_final_lng)
        config.ponto_partida_ativo = 'ponto_partida_ativo' in request.POST
        config.ponto_partida_nome = request.POST.get('ponto_partida_nome', '').strip()
        config.ponto_final_ativo = 'ponto_final_ativo' in request.POST
        config.ponto_final_nome = request.POST.get('ponto_final_nome', '').strip()
        config.permitir_pedidos_sem_coordenadas = 'permitir_pedidos_sem_coordenadas' in request.POST
        config.permitir_pedido_multiplas_rotas = 'permitir_pedido_multiplas_rotas' in request.POST
        motor = request.POST.get('otimizacao_motor', 'local')
        if motor not in ('local', 'vroom', 'ors'):
            motor = 'local'
        config.otimizacao_motor = motor
        config.ors_api_key = request.POST.get('ors_api_key', '').strip()
        config.google_maps_api_key = request.POST.get('google_maps_api_key', '').strip()
        config.google_maps_search_country = _normalize_google_maps_country(request.POST.get('google_maps_search_country', 'br'))
        # Rotas ocultas: lista vinda do POST como valores múltiplos
        rotas_ocultas_raw = request.POST.getlist('rotas_ocultas')
        config.rotas_ocultas = [r.strip() for r in rotas_ocultas_raw if r.strip()]
        config.save()
        return redirect('rotas:configuracao_usuario')

    # Rotas conhecidas: valores únicos de entregador dos pedidos do usuário
    rotas_conhecidas = sorted(set(
        str(v).strip()
        for v in PedidoFirebird.objects.filter(usuario=request.user)
                                        .values_list('entregador', flat=True)
        if v and str(v).strip()
    ))
    query_ativa_cfg = QueryFirebird.objects.filter(usuario=request.user, ativo=True).order_by('-data_modificacao').first()
    sql_ativo_cfg = query_ativa_cfg.sql if query_ativa_cfg else ''
    campos_sql_cfg = _extract_sql_aliases(sql_ativo_cfg) or SQL_CAMPOS_DISPONIVEIS
    cfg_global = ConfiguracaoGlobal.get_instance()
    # Inclui data_importacao como campo especial no topo da lista
    campos_sql_com_data = ['data_importacao'] + [c for c in campos_sql_cfg if c != 'data_importacao']
    context = {
        'config': config,
        'rotas_conhecidas': rotas_conhecidas,
        'campos_sql': campos_sql_com_data,
        'filtros_exclusao_pedidos': config.filtros_exclusao_pedidos or [],
        'regras_arquivamento': cfg_global.regras_arquivamento_pedidos or [],
        'intervalo_arquivamento_horas': cfg_global.intervalo_arquivamento_horas or 24,
        'ultima_execucao_arquivamento': (
            cfg_global.ultima_execucao_arquivamento.strftime('%d/%m/%Y %H:%M')
            if cfg_global.ultima_execucao_arquivamento else ''
        ),
        'intervalo_quarentena_horas': cfg_global.intervalo_quarentena_horas or 24,
        'ultima_execucao_quarentena': (
            cfg_global.ultima_execucao_quarentena.strftime('%d/%m/%Y %H:%M')
            if cfg_global.ultima_execucao_quarentena else ''
        ),
        'google_maps_key_resolved': _resolve_google_maps_key(config),
        'google_maps_global_configured': bool(str(getattr(settings, 'GOOGLE_MAPS_API_KEY', '') or '').strip()),
    }
    return render(request, 'rotas/configuracao_usuario.html', context)


@login_required
@require_POST
def salvar_campos_card_index(request):
    """Salva a configuração de campos do card (index) no banco do usuário."""
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'success': False, 'message': 'Payload JSON inválido.'}, status=400)

    campos = payload.get('campos')
    if not isinstance(campos, list):
        return JsonResponse({'success': False, 'message': 'Lista de campos inválida.'}, status=400)

    regras_cor = payload.get('regras_cor', [])
    if regras_cor is None:
        regras_cor = []
    if not isinstance(regras_cor, list):
        return JsonResponse({'success': False, 'message': 'Lista de regras de cor inválida.'}, status=400)
    
    tipo_card = payload.get('tipo_card', 'pedidos')  # 'pedidos' ou 'rotas'
    if tipo_card not in ['pedidos', 'rotas']:
        tipo_card = 'pedidos'

    campos_normalizados = _normalize_campos_config(campos)
    if not campos_normalizados:
        return JsonResponse({'success': False, 'message': 'Nenhum campo válido recebido.'}, status=400)

    config, _ = ConfiguracaoUsuario.objects.get_or_create(usuario=request.user)
    
    if tipo_card == 'rotas':
        config.campos_exibicao_rotas = campos_normalizados
        config.rotas_card_regras_cor = _normalize_regras_cor_config(regras_cor)
        config.save(update_fields=['campos_exibicao_rotas', 'rotas_card_regras_cor'])
        return JsonResponse({
            'success': True,
            'campos': campos_normalizados,
            'regras_cor': _normalize_regras_cor_config(config.rotas_card_regras_cor or []),
            'tipo_card': 'rotas',
        })
    else:
        config.campos_exibicao_pedidos = campos_normalizados
        config.pedidos_card_regras_cor = _normalize_regras_cor_config(regras_cor)
        config.save(update_fields=['campos_exibicao_pedidos', 'pedidos_card_regras_cor'])
        return JsonResponse({
            'success': True,
            'campos': campos_normalizados,
            'regras_cor': _normalize_regras_cor_config(config.pedidos_card_regras_cor or []),
            'tipo_card': 'pedidos',
        })


@login_required
@require_POST
def salvar_config_visual_rotas(request):
    """Salva configurações visuais dos cards de rota"""
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'success': False, 'message': 'Payload JSON inválido.'}, status=400)
    
    config, _ = ConfiguracaoUsuario.objects.get_or_create(usuario=request.user)
    
    # Atualizar todas as configurações visuais
    config.rotas_card_mostrar_numero = payload.get('rotas_card_mostrar_numero', True)
    config.rotas_card_cor_fundo = payload.get('rotas_card_cor_fundo', '#ffffff')
    config.rotas_card_cor_borda = payload.get('rotas_card_cor_borda', '#dadce0')
    config.rotas_card_cor_numero = payload.get('rotas_card_cor_numero', '#4285F4')
    config.rotas_card_tamanho_fonte = int(payload.get('rotas_card_tamanho_fonte', 13))
    config.rotas_card_padding_vertical = int(payload.get('rotas_card_padding_vertical', 12))
    config.rotas_card_padding_horizontal = int(payload.get('rotas_card_padding_horizontal', 12))
    config.rotas_card_raio = int(payload.get('rotas_card_raio', 8))
    
    config.save()
    
    return JsonResponse({
        'success': True,
        'message': 'Configurações visuais salvas com sucesso!'
    })


@login_required
@require_POST
def salvar_config_busca_endereco(request):
    """Salva a configuração global dos campos usados na busca textual de endereços."""
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'success': False, 'message': 'Payload JSON inválido.'}, status=400)

    campos = payload.get('campos')
    if not isinstance(campos, list):
        return JsonResponse({'success': False, 'message': 'Lista de campos inválida.'}, status=400)

    campos_disponiveis = _extract_sql_aliases(payload.get('sql_ativo') or '') or SQL_CAMPOS_DISPONIVEIS
    campos_normalizados = _normalize_campos_busca_endereco(campos, campos_disponiveis)

    cfg_global = ConfiguracaoGlobal.get_instance()
    cfg_global.campos_busca_endereco = campos_normalizados
    cfg_global.save(update_fields=['campos_busca_endereco'])

    return JsonResponse({
        'success': True,
        'campos': campos_normalizados,
        'message': 'Configuração da busca de endereço salva com sucesso!',
    })


@login_required
@require_POST
def salvar_rotas_ocultas(request):
    """Salva a lista de rotas ocultas do painel de pedidos."""
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'success': False, 'message': 'Payload JSON inválido.'}, status=400)

    rotas_ocultas = payload.get('rotas_ocultas')
    if not isinstance(rotas_ocultas, list):
        return JsonResponse({'success': False, 'message': 'Lista inválida.'}, status=400)

    rotas_ocultas = [str(r).strip() for r in rotas_ocultas if r and str(r).strip()]
    config, _ = ConfiguracaoUsuario.objects.get_or_create(usuario=request.user)
    config.rotas_ocultas = rotas_ocultas
    config.save(update_fields=['rotas_ocultas'])
    return JsonResponse({'success': True, 'rotas_ocultas': rotas_ocultas})


@login_required
@require_POST
def salvar_filtros_exclusao(request):
    """Salva os filtros de exclusão de pedidos do painel."""
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'success': False, 'message': 'Payload JSON inválido.'}, status=400)

    filtros = payload.get('filtros')
    if not isinstance(filtros, list):
        return JsonResponse({'success': False, 'message': 'Lista de filtros inválida.'}, status=400)

    operadores_validos = {'igual', 'diferente', 'contem', 'nao_contem', 'maior', 'maior_igual', 'menor', 'menor_igual', 'vazio', 'nao_vazio'}
    filtros_normalizados = []
    for item in filtros:
        if not isinstance(item, dict):
            continue
        campo = str(item.get('campo', '')).strip()
        if not campo:
            continue
        operador = str(item.get('operador', 'igual')).strip().lower()
        if operador not in operadores_validos:
            operador = 'igual'
        filtros_normalizados.append({
            'campo': campo,
            'operador': operador,
            'valor': str(item.get('valor', '')).strip(),
            'ativo': bool(item.get('ativo', True)),
        })

    config, _ = ConfiguracaoUsuario.objects.get_or_create(usuario=request.user)
    config.filtros_exclusao_pedidos = filtros_normalizados
    config.save(update_fields=['filtros_exclusao_pedidos'])
    return JsonResponse({'success': True, 'filtros': filtros_normalizados})


@login_required
@require_POST
def salvar_regras_arquivamento(request):
    """Salva as regras de arquivamento automático de pedidos (configuração global)."""
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'success': False, 'message': 'Payload JSON inválido.'}, status=400)

    regras = payload.get('regras')
    if not isinstance(regras, list):
        return JsonResponse({'success': False, 'message': 'Lista de regras inválida.'}, status=400)

    operadores_validos = {
        'igual', 'diferente', 'contem', 'nao_contem',
        'maior', 'maior_igual', 'menor', 'menor_igual',
        'vazio', 'nao_vazio', 'ha_mais_de', 'ha_menos_de',
    }
    regras_normalizadas = []
    for item in regras:
        if not isinstance(item, dict):
            continue
        campo = str(item.get('campo', '')).strip()
        if not campo:
            continue
        operador = str(item.get('operador', 'igual')).strip().lower()
        if operador not in operadores_validos:
            operador = 'igual'
        try:
            dias_q = max(0, int(item.get('dias_quarentena', 0)))
        except (ValueError, TypeError):
            dias_q = 0
        regras_normalizadas.append({
            'campo': campo,
            'operador': operador,
            'valor': str(item.get('valor', '')).strip(),
            'ativo': bool(item.get('ativo', True)),
            'dias_quarentena': dias_q,
        })

    cfg_global = ConfiguracaoGlobal.get_instance()
    intervalo_h = payload.get('intervalo_horas', 24)
    try:
        intervalo_h = max(1, int(intervalo_h))
    except (ValueError, TypeError):
        intervalo_h = 24
    intervalo_q = payload.get('intervalo_quarentena_horas', 24)
    try:
        intervalo_q = max(1, int(intervalo_q))
    except (ValueError, TypeError):
        intervalo_q = 24
    cfg_global.regras_arquivamento_pedidos = regras_normalizadas
    cfg_global.intervalo_arquivamento_horas = intervalo_h
    cfg_global.intervalo_quarentena_horas = intervalo_q
    cfg_global.save(update_fields=['regras_arquivamento_pedidos', 'intervalo_arquivamento_horas', 'intervalo_quarentena_horas'])
    return JsonResponse({'success': True, 'regras': regras_normalizadas, 'intervalo_horas': intervalo_h, 'intervalo_quarentena_horas': intervalo_q})


@login_required
@require_POST
def executar_arquivamento_agora(request):
    """Executa as regras de arquivamento imediatamente, ignorando o intervalo configurado."""
    cfg_global = ConfiguracaoGlobal.get_instance()
    count = _executar_arquivamento_global(cfg_global)
    cfg_global.ultima_execucao_arquivamento = timezone.now()
    cfg_global.save(update_fields=['ultima_execucao_arquivamento'])
    ultima_fmt = cfg_global.ultima_execucao_arquivamento.strftime('%d/%m/%Y %H:%M')
    return JsonResponse({
        'success': True,
        'arquivados': count,
        'ultima_execucao': ultima_fmt,
    })


@login_required
@require_POST
def executar_quarentena_agora(request):
    """Executa a quarentena imediatamente, ignorando o intervalo configurado."""
    cfg_global = ConfiguracaoGlobal.get_instance()
    count = _executar_quarentena_global()
    cfg_global.ultima_execucao_quarentena = timezone.now()
    cfg_global.save(update_fields=['ultima_execucao_quarentena'])
    ultima_fmt = cfg_global.ultima_execucao_quarentena.strftime('%d/%m/%Y %H:%M')
    return JsonResponse({
        'success': True,
        'excluidos': count,
        'ultima_execucao': ultima_fmt,
    })


@login_required
def historico_exclusoes(request):
    """Retorna JSON com histórico de pedidos excluídos, filtrado por período."""
    data_de = request.GET.get('data_de', '').strip()
    data_ate = request.GET.get('data_ate', '').strip()
    qs = HistoricoExclusaoPedido.objects.all()
    if data_de:
        try:
            dt_de = datetime.strptime(data_de, '%Y-%m-%d')
            qs = qs.filter(data_exclusao__gte=dt_de)
        except ValueError:
            pass
    if data_ate:
        try:
            dt_ate = datetime.strptime(data_ate, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            qs = qs.filter(data_exclusao__lte=dt_ate)
        except ValueError:
            pass
    registros = list(qs.order_by('-data_exclusao').values(
        'id', 'numero_pedido', 'cliente_nome', 'entregador', 'endereco',
        'data_importacao', 'data_arquivamento', 'dias_quarentena', 'data_exclusao',
    )[:500])
    for r in registros:
        for campo in ('data_importacao', 'data_arquivamento', 'data_exclusao'):
            if r[campo]:
                r[campo] = r[campo].strftime('%d/%m/%Y %H:%M')
    return JsonResponse({'success': True, 'registros': registros, 'total': len(registros)})


@login_required
def historico_exclusoes_csv(request):
    """Exporta histórico de exclusões em CSV."""
    import io as _io
    data_de = request.GET.get('data_de', '').strip()
    data_ate = request.GET.get('data_ate', '').strip()
    qs = HistoricoExclusaoPedido.objects.all()
    if data_de:
        try:
            dt_de = datetime.strptime(data_de, '%Y-%m-%d')
            qs = qs.filter(data_exclusao__gte=dt_de)
        except ValueError:
            pass
    if data_ate:
        try:
            dt_ate = datetime.strptime(data_ate, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            qs = qs.filter(data_exclusao__lte=dt_ate)
        except ValueError:
            pass

    def _fmt(dt):
        return dt.strftime('%d/%m/%Y %H:%M') if dt else ''

    def generate():
        yield '\ufeff'  # BOM para Excel
        buf = _io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(['Número Pedido', 'Cliente', 'Entregador', 'Endereço',
                         'Data Importação', 'Data Arquivamento', 'Dias Quarentena', 'Data Exclusão'])
        yield buf.getvalue()
        for item in qs.order_by('-data_exclusao').iterator():
            buf = _io.StringIO()
            writer = csv.writer(buf)
            writer.writerow([
                item.numero_pedido, item.cliente_nome, item.entregador or '',
                item.endereco or '', _fmt(item.data_importacao),
                _fmt(item.data_arquivamento), item.dias_quarentena or '',
                _fmt(item.data_exclusao),
            ])
            yield buf.getvalue()

    response = StreamingHttpResponse(generate(), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="historico_exclusoes.csv"'
    return response


@login_required
def editor_sql_page(request):
    """Página unificada: SQL Principal (QueryFirebird) + SQLs Extra (SqlExtra)."""
    query_ativa = QueryFirebird.objects.filter(usuario=request.user, ativo=True).order_by('-data_modificacao').first()
    sql_ativo = query_ativa.sql if query_ativa else ''
    campos_sql = _extract_sql_aliases(sql_ativo) or SQL_CAMPOS_DISPONIVEIS
    sqls_extra = list(SqlExtra.objects.filter(usuario=request.user).order_by('data_criacao').values(
        'id', 'nome', 'tipo', 'descricao', 'sql', 'campo_join_pedido',
    ))
    tipos_extra = SqlExtra.TIPO_CHOICES
    return render(request, 'rotas/firebird_editor_sql.html', {
        'query_ativa': query_ativa,
        'sql_ativo': sql_ativo,
        'campos_sql': campos_sql,
        'sqls_extra': sqls_extra,
        'tipos_extra': tipos_extra,
    })


@login_required
def listar_nomes_fixos_rota(request):
    nomes = list(
        NomeFixoRota.objects.filter(usuario=request.user)
        .order_by('nome')
        .values('id', 'nome')
    )
    return JsonResponse({'success': True, 'nomes': nomes})


@login_required
@require_POST
def salvar_nome_fixo_rota(request):
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'success': False, 'message': 'Payload JSON inválido.'}, status=400)

    nome = _normalizar_nome_fixo_rota(payload.get('nome'))
    if not nome:
        return JsonResponse({'success': False, 'message': 'Informe um nome para salvar.'}, status=400)

    if len(nome) > 80:
        return JsonResponse({'success': False, 'message': 'O nome deve ter no máximo 80 caracteres.'}, status=400)

    existente = NomeFixoRota.objects.filter(usuario=request.user, nome__iexact=nome).first()
    if existente:
        return JsonResponse({
            'success': True,
            'created': False,
            'message': 'Esse nome já está salvo.',
            'item': {'id': existente.id, 'nome': existente.nome},
        })

    item = NomeFixoRota.objects.create(usuario=request.user, nome=nome)
    return JsonResponse({
        'success': True,
        'created': True,
        'message': 'Nome salvo com sucesso.',
        'item': {'id': item.id, 'nome': item.nome},
    })


@login_required
@require_POST
def deletar_nome_fixo_rota(request, pk):
    item = get_object_or_404(NomeFixoRota, pk=pk, usuario=request.user)
    item.delete()
    return JsonResponse({'success': True, 'message': 'Nome fixo removido com sucesso.'})


@login_required
@require_POST
def salvar_sql_card_index(request):
    """Salva SQL da query ativa e retorna aliases disponíveis para o card."""
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'success': False, 'message': 'Payload JSON inválido.'}, status=400)

    sql = str(payload.get('sql') or '').strip()
    if not sql:
        return JsonResponse({'success': False, 'message': 'Informe um SQL válido.'}, status=400)

    aliases = _extract_sql_aliases(sql)
    try:
        query, created = _get_or_create_query_tecnica(request.user, sql=sql)
    except ValueError as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=400)

    query.sql = sql
    update_fields = ['sql', 'data_modificacao']
    mapping = _build_mapping_from_aliases(aliases)
    for field_name, field_value in mapping.items():
        if field_value:
            setattr(query, field_name, field_value)
            update_fields.append(field_name)

    query.save(update_fields=list(dict.fromkeys(update_fields)))

    return JsonResponse({
        'success': True,
        'message': 'SQL salvo com sucesso.' if not created else 'SQL salvo e query técnica criada com sucesso.',
        'campos_sql_disponiveis': aliases or SQL_CAMPOS_DISPONIVEIS,
        'query_id': query.id,
    })


@login_required
@require_POST
def testar_sql_card_index(request):
    """Executa preview do SQL no Firebird para o modal do index."""
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'success': False, 'message': 'Payload JSON inválido.'}, status=400)

    sql = str(payload.get('sql') or '').strip()
    if not sql:
        return JsonResponse({'success': False, 'message': 'Informe um SQL para testar.'}, status=400)

    _sql_check = re.sub(r'--[^\r\n]*', ' ', sql)
    _sql_check = re.sub(r'/\*[\s\S]*?\*/', ' ', _sql_check).strip()
    if not re.match(r'^\s*(with|select)\b', _sql_check, flags=re.IGNORECASE):
        return JsonResponse({'success': False, 'message': 'Apenas consultas SELECT são permitidas no teste.'}, status=400)

    conexao = ConexaoFirebird.objects.filter(usuario=request.user, ativo=True).first()
    if not conexao:
        return JsonResponse({'success': False, 'message': 'Configure uma conexão Firebird ativa para testar SQL.'}, status=400)

    # Substituir parâmetros nomeados (:nome) pelo valor informado
    # Usa versão sem comentários para evitar falsos positivos (ex.: -- :empresa)
    _sql_stripped = re.sub(r'--[^\r\n]*', ' ', sql.strip().rstrip(';'))
    _sql_stripped = re.sub(r'/\*[\s\S]*?\*/', ' ', _sql_stripped)
    test_params_dict = payload.get('params') or {}
    test_params_values = []
    named_params_found = re.findall(r':([a-zA-Z_][a-zA-Z0-9_]*)', _sql_stripped)
    if named_params_found and isinstance(test_params_dict, dict):
        for pm in named_params_found:
            test_params_values.append(str(test_params_dict.get(pm, '')))
        sql_final = re.sub(r':[a-zA-Z_][a-zA-Z0-9_]*', '?', _sql_stripped)
    else:
        sql_final = _sql_stripped

    conn = None
    cursor = None
    try:
        started_at = time.perf_counter()
        conn = conectar_firebird(conexao)
        cursor = conn.cursor()
        if test_params_values:
            cursor.execute(sql_final, test_params_values)
        else:
            cursor.execute(sql_final)

        rows = cursor.fetchmany(5)
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        data = [dict(zip(columns, row)) for row in rows]
        aliases = _extract_sql_aliases(sql)
        execution_ms = round((time.perf_counter() - started_at) * 1000, 2)

        return JsonResponse({
            'success': True,
            'columns': columns,
            'data': data,
            'count': len(data),
            'execution_ms': execution_ms,
            'campos_sql_disponiveis': aliases or columns or SQL_CAMPOS_DISPONIVEIS,
            'message': f'{len(data)} registro(s) retornado(s) no preview.',
        })
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Erro ao testar SQL: {str(e)}'}, status=400)
    finally:
        try:
            if cursor:
                cursor.close()
        except Exception:
            pass
        try:
            if conn:
                conn.close()
        except Exception:
            pass


@login_required
@require_POST
def sqls_extra_salvar(request):
    """Cria ou atualiza um SqlExtra. Retorna JSON com o registro salvo."""
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'success': False, 'message': 'Payload JSON inválido.'}, status=400)

    sql_id = payload.get('id')
    nome = str(payload.get('nome') or '').strip()
    descricao = str(payload.get('descricao') or '').strip()
    tipo = str(payload.get('tipo') or 'personalizado').strip()
    sql_text = str(payload.get('sql') or '').strip()
    campo_join = str(payload.get('campo_join_pedido') or '').strip()
    campos_join_raw = payload.get('campos_join')

    if not nome:
        return JsonResponse({'success': False, 'message': 'Informe um nome para o SQL.'}, status=400)
    if not sql_text:
        return JsonResponse({'success': False, 'message': 'Informe o SQL.'}, status=400)

    tipos_validos = [t[0] for t in SqlExtra.TIPO_CHOICES]
    if tipo not in tipos_validos:
        tipo = 'personalizado'

    conexao = ConexaoFirebird.objects.filter(usuario=request.user, ativo=True).first()
    if not conexao:
        return JsonResponse({'success': False, 'message': 'Configure uma conexão Firebird ativa primeiro.'}, status=400)

    if sql_id:
        obj = get_object_or_404(SqlExtra, pk=sql_id, usuario=request.user)
        created = False
    else:
        obj = SqlExtra(usuario=request.user, conexao=conexao)
        created = True

    obj.nome = nome
    obj.descricao = descricao or None
    obj.tipo = tipo
    obj.sql = sql_text
    obj.campo_join_pedido = campo_join or None
    # campos_join: lista de {coluna_sql, campo_pedido}
    if isinstance(campos_join_raw, list):
        campos_join_clean = []
        for par in campos_join_raw:
            if isinstance(par, dict):
                cs = str(par.get('coluna_sql') or '').strip()
                cp = str(par.get('campo_pedido') or '').strip()
                if cs and cp:
                    campos_join_clean.append({'coluna_sql': cs, 'campo_pedido': cp})
        obj.campos_join = campos_join_clean
    elif campos_join_raw is None and campo_join:
        # Backward compat: se só mandou campo_join_pedido antigo, converte
        obj.campos_join = [{'coluna_sql': campo_join, 'campo_pedido': 'numero_pedido'}]
    obj.ativo = True
    obj.save()

    aliases = _extract_sql_aliases(sql_text)
    return JsonResponse({
        'success': True,
        'message': 'SQL criado com sucesso.' if created else 'SQL atualizado com sucesso.',
        'id': obj.id,
        'nome': obj.nome,
        'tipo': obj.tipo,
        'tipo_display': obj.get_tipo_display(),
        'aliases': aliases,
        'created': created,
    })


@login_required
@require_POST
def sqls_extra_deletar(request, pk):
    """Remove um SqlExtra."""
    obj = get_object_or_404(SqlExtra, pk=pk, usuario=request.user)
    nome = obj.nome
    obj.delete()
    return JsonResponse({'success': True, 'message': f'SQL "{nome}" excluído.'})


@login_required
@require_POST
def sqls_extra_testar(request):
    """Executa preview de um SqlExtra no Firebird e retorna até 10 linhas."""
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'success': False, 'message': 'Payload JSON inválido.'}, status=400)

    sql = str(payload.get('sql') or '').strip()
    if not sql:
        return JsonResponse({'success': False, 'message': 'Informe o SQL para testar.'}, status=400)

    _sql_check = re.sub(r'--[^\r\n]*', ' ', sql)
    _sql_check = re.sub(r'/\*[\s\S]*?\*/', ' ', _sql_check).strip()
    if not re.match(r'^\s*(with|select)\b', _sql_check, flags=re.IGNORECASE):
        return JsonResponse({'success': False, 'message': 'Apenas consultas SELECT são permitidas no teste.'}, status=400)

    conexao = ConexaoFirebird.objects.filter(usuario=request.user, ativo=True).first()
    if not conexao:
        return JsonResponse({'success': False, 'message': 'Configure uma conexão Firebird ativa para testar SQL.'}, status=400)

    # Substituir parâmetros nomeados (:nome) pelo valor informado (ou string vazia)
    # Usa versão sem comentários para evitar falsos positivos (ex.: -- :empresa)
    test_params_dict = payload.get('params') or {}
    _sql_stripped = re.sub(r'--[^\r\n]*', ' ', sql.strip().rstrip(';'))
    _sql_stripped = re.sub(r'/\*[\s\S]*?\*/', ' ', _sql_stripped)
    test_params_values = []
    named_params_found = re.findall(r':([a-zA-Z_][a-zA-Z0-9_]*)', _sql_stripped)
    if named_params_found and isinstance(test_params_dict, dict):
        # Uma entrada por ocorrência (sem deduplicar) — o Firebird precisa de um
        # valor para cada '?' na ordem em que aparecem. Se :codigo aparece 2x em
        # uma UNION ALL, precisamos passar o valor 2 vezes.
        for pm in named_params_found:
            test_params_values.append(str(test_params_dict.get(pm, '')))
        sql_final = re.sub(r':[a-zA-Z_][a-zA-Z0-9_]*', '?', _sql_stripped)
    else:
        sql_final = _sql_stripped

    conn = None
    cursor = None
    try:
        started_at = time.perf_counter()
        conn = conectar_firebird(conexao)
        cursor = conn.cursor()
        if test_params_values:
            cursor.execute(sql_final, test_params_values)
        else:
            cursor.execute(sql_final)
        rows = cursor.fetchmany(10)
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        data = [dict(zip(columns, row)) for row in rows]
        aliases = _extract_sql_aliases(sql)
        execution_ms = round((time.perf_counter() - started_at) * 1000, 2)
        return JsonResponse({
            'success': True,
            'columns': columns,
            'data': data,
            'count': len(data),
            'execution_ms': execution_ms,
            'aliases': aliases or columns,
            'message': f'{len(data)} registro(s) retornado(s) no preview.',
        })
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Erro ao testar SQL: {str(e)}'}, status=400)
    finally:
        try:
            if cursor:
                cursor.close()
        except Exception:
            pass
        try:
            if conn:
                conn.close()
        except Exception:
            pass


@login_required
def sqls_extra_get(request, pk):
    """Retorna os dados de um SqlExtra para edição via AJAX."""
    obj = get_object_or_404(SqlExtra, pk=pk, usuario=request.user)
    return JsonResponse({
        'id': obj.id,
        'nome': obj.nome,
        'descricao': obj.descricao or '',
        'tipo': obj.tipo,
        'sql': obj.sql,
        'campo_join_pedido': obj.campo_join_pedido or '',
        'campos_join': obj.campos_join or [],
    })


# ── Campos disponíveis para ligação ────────────────────────────────

@login_required
def campos_disponiveis(request):
    """Retorna campos disponíveis no pedido para uso como ligação em SqlExtra."""
    # Campos diretos do modelo PedidoFirebird
    campos_diretos = ['numero_pedido', 'cliente_nome', 'entregador', 'endereco', 'telefone', 'email']

    # Extrair chaves reais do dados_json do primeiro pedido ativo
    campos_json = []
    pedido = PedidoFirebird.objects.filter(
        usuario=request.user, arquivado=False
    ).exclude(dados_json={}).exclude(dados_json__isnull=True).first()
    if pedido and isinstance(pedido.dados_json, dict):
        campos_json = [k for k in pedido.dados_json.keys() if k not in campos_diretos]

    return JsonResponse({
        'success': True,
        'campos_diretos': campos_diretos,
        'campos_json': sorted(campos_json),
    })


# ── Raio X do Cliente ──────────────────────────────────────────────

@login_required
def raio_x_listar_sqls(request):
    """Retorna lista de SqlExtra ativas do usuário para o modal Raio X."""
    qs = SqlExtra.objects.filter(usuario=request.user, ativo=True).order_by('nome')
    sqls = [
        {
            'id': obj.id,
            'nome': obj.nome,
            'descricao': obj.descricao or '',
            'tipo': obj.tipo,
            'campo_join_pedido': obj.campo_join_pedido or '',
            'campos_join': obj.campos_join or [],
            'sql_text': obj.sql or '',
        }
        for obj in qs
    ]
    return JsonResponse({'success': True, 'sqls': sqls})


@login_required
def raio_x_abas_listar(request):
    """Retorna lista de abas do Raio X do usuário. Cria aba padrão se não houver nenhuma."""
    abas_qs = RaioXAba.objects.filter(usuario=request.user, ativo=True).select_related('sql_extra').order_by('ordem', 'id')
    if not abas_qs.exists():
        RaioXAba.objects.create(
            usuario=request.user,
            nome='Dados do Pedido',
            ordem=0,
            tipo='dados_pedido',
            componentes_ordem=['dados'],
        )
        abas_qs = RaioXAba.objects.filter(usuario=request.user, ativo=True).select_related('sql_extra').order_by('ordem', 'id')
    return JsonResponse({'success': True, 'abas': [
        {
            'id': a.id,
            'nome': a.nome,
            'ordem': a.ordem,
            'tipo': a.tipo,
            'sql_extra_id': a.sql_extra_id,
            'sql_extra_nome': a.sql_extra.nome if a.sql_extra else '',
            'sql_text': a.sql_extra.sql if a.sql_extra else '',
            'campos_join': a.campos_join or [],
            'kpis_config': a.kpis_config or [],
            'colunas_visiveis': a.colunas_visiveis or [],
            'grafico_config': a.grafico_config or {},
            'pivot_config': a.pivot_config or {},
            'widget_configs': a.widget_configs or {},
            'sqls_extras': a.sqls_extras or [],
            'detail_config': a.detail_config or {},
            'componentes_ordem': a.componentes_ordem or ['kpis', 'tabela', 'grafico', 'texto'],
            'layout_config': a.layout_config or {},
            'texto': a.texto or '',
        }
        for a in abas_qs
    ]})


@login_required
@require_POST
def raio_x_abas_salvar(request):
    """Salva lista completa de abas do Raio X (replace total)."""
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'success': False, 'message': 'Payload JSON inválido.'}, status=400)

    abas_data = payload.get('abas', [])
    if not isinstance(abas_data, list):
        return JsonResponse({'success': False, 'message': '"abas" deve ser uma lista.'}, status=400)

    # Validar que pelo menos uma aba existe
    if not abas_data:
        return JsonResponse({'success': False, 'message': 'Deve haver ao menos uma aba.'}, status=400)

    abas_existentes = {
        aba.id: aba
        for aba in RaioXAba.objects.filter(usuario=request.user)
    }
    ids_recebidos = {
        int(aba['id'])
        for aba in abas_data
        if isinstance(aba, dict) and str(aba.get('id') or '').isdigit()
    }

    with transaction.atomic():
        if ids_recebidos:
            RaioXAba.objects.filter(usuario=request.user).exclude(id__in=ids_recebidos).delete()
        else:
            RaioXAba.objects.filter(usuario=request.user).delete()

        for i, aba in enumerate(abas_data):
            sql_extra = None
            if aba.get('sql_extra_id'):
                sql_extra = SqlExtra.objects.filter(pk=aba['sql_extra_id'], usuario=request.user).first()

            aba_id = aba.get('id')
            instance = abas_existentes.get(aba_id)
            if instance is None:
                instance = RaioXAba(usuario=request.user)

            instance.nome = (aba.get('nome') or 'Aba').strip() or 'Aba'
            instance.ordem = i
            instance.tipo = aba.get('tipo') or 'sql'
            instance.sql_extra = sql_extra
            instance.campos_join = aba.get('campos_join') or []
            instance.kpis_config = aba.get('kpis_config') or []
            instance.colunas_visiveis = aba.get('colunas_visiveis') or []
            instance.grafico_config = aba.get('grafico_config') or {}
            instance.pivot_config = aba.get('pivot_config') or {}
            instance.widget_configs = aba.get('widget_configs') or {}
            instance.sqls_extras = aba.get('sqls_extras') or []
            instance.detail_config = aba.get('detail_config') or {}
            instance.componentes_ordem = aba.get('componentes_ordem') or ['kpis', 'tabela', 'grafico', 'texto']
            instance.layout_config = aba.get('layout_config') or {}
            instance.texto = aba.get('texto') or ''
            instance.ativo = True
            instance.save()

    return JsonResponse({'success': True, 'message': f'{len(abas_data)} aba(s) salva(s).'})


@login_required
@require_POST
def raio_x_executar_sql(request):
    """Executa um SqlExtra filtrado pelo número do pedido e retorna os dados."""
    try:
        payload = json.loads(request.body.decode('utf-8') or '{}')
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({'success': False, 'message': 'Payload JSON inválido.'}, status=400)

    sql_extra_id = payload.get('sql_extra_id')
    numero_pedido = str(payload.get('numero_pedido') or '').strip()
    pedido_id = payload.get('pedido_id')

    if not sql_extra_id:
        return JsonResponse({'success': False, 'message': 'Selecione um SQL Extra.'}, status=400)

    obj = SqlExtra.objects.filter(pk=sql_extra_id, usuario=request.user, ativo=True).first()
    if not obj:
        return JsonResponse({'success': False, 'message': 'SQL Extra não encontrado.'}, status=400)

    _sql_check = re.sub(r'--[^\r\n]*', ' ', obj.sql)
    _sql_check = re.sub(r'/\*[\s\S]*?\*/', ' ', _sql_check).strip()
    if not re.match(r'^\s*(with|select)\b', _sql_check, flags=re.IGNORECASE):
        return JsonResponse({'success': False, 'message': 'Apenas consultas SELECT são permitidas.'}, status=400)

    conexao = ConexaoFirebird.objects.filter(usuario=request.user, ativo=True).first()
    if not conexao:
        return JsonResponse({'success': False, 'message': 'Configure uma conexão Firebird ativa.'}, status=400)

    # ── Injetar valores nos parâmetros nomeados do SQL ──
    # O frontend pode enviar um mapeamento custom; se não, usa o salvo no objeto
    campos_join_payload = payload.get('campos_join')
    if isinstance(campos_join_payload, list):
        campos_join = campos_join_payload
    else:
        campos_join = obj.campos_join or []
    campo_join_legado = (obj.campo_join_pedido or '').strip()
    sql_final = obj.sql.strip().rstrip(';')
    params = []
    filtered_fields = []

    # Carregar pedido para extrair valores de dados_json
    pedido_obj = None
    if pedido_id:
        pedido_obj = PedidoFirebird.objects.filter(pk=pedido_id, usuario=request.user).first()

    # Campos diretos do modelo PedidoFirebird
    campos_diretos = {}
    dados_json = {}
    if pedido_obj:
        dados_json = pedido_obj.dados_json or {}
        campos_diretos = {
            'numero_pedido': pedido_obj.numero_pedido,
            'cliente_nome': pedido_obj.cliente_nome,
            'entregador': pedido_obj.entregador or '',
            'endereco': pedido_obj.endereco or '',
            'telefone': pedido_obj.telefone or '',
            'email': pedido_obj.email or '',
        }

    # Strip de comentários antes de detectar/substituir parâmetros nomeados.
    # Evita falsos positivos como `:empresa` em `-- WHERE cli.empresa = :empresa`.
    sql_final = re.sub(r'--[^\r\n]*', ' ', sql_final)
    sql_final = re.sub(r'/\*[\s\S]*?\*/', ' ', sql_final)

    # Detectar parâmetros nomeados (:nome) no SQL
    named_params = re.findall(r':([a-zA-Z_][a-zA-Z0-9_]*)', sql_final)

    if named_params:
        # Substitui :param por ? em ordem — usa campos_join se disponível, senão string vazia
        # (garante que SQLs com parâmetros rodam mesmo sem mapeamento, ex: ao carregar colunas)
        mapping = {p['coluna_sql'].strip(): p['campo_pedido'].strip()
                   for p in campos_join if p.get('coluna_sql') and p.get('campo_pedido')}
        for pm in named_params:
            campo_pedido = mapping.get(pm, '')
            valor = campos_diretos.get(campo_pedido)
            if valor is None:
                valor = dados_json.get(campo_pedido)
            params.append(str(valor).strip() if valor is not None else '')
            if campo_pedido:
                filtered_fields.append(f':{pm}={campo_pedido}')
        sql_final = re.sub(r':[a-zA-Z_][a-zA-Z0-9_]*', '?', sql_final)
    elif campos_join and (pedido_obj or numero_pedido):
        # Fallback: campos_join mas SQL sem :params — envolver em subquery
        where_clauses = []
        for par in campos_join:
            coluna_sql = par.get('coluna_sql', '').strip()
            campo_pedido = par.get('campo_pedido', '').strip()
            if not coluna_sql or not campo_pedido:
                continue
            valor = campos_diretos.get(campo_pedido)
            if valor is None:
                valor = dados_json.get(campo_pedido)
            if valor is not None and str(valor).strip():
                where_clauses.append(f'sq."{coluna_sql}" = ?')
                params.append(str(valor).strip())
                filtered_fields.append(f'{coluna_sql}={campo_pedido}')
        if where_clauses:
            sql_final = f'SELECT sq.* FROM ({sql_final}) sq WHERE {" AND ".join(where_clauses)}'
    elif campo_join_legado and numero_pedido:
        # Backward compat: campo_join_pedido antigo
        sql_final = f'SELECT sq.* FROM ({sql_final}) sq WHERE sq."{campo_join_legado}" = ?'
        params = [numero_pedido]
        filtered_fields = [campo_join_legado]

    conn = None
    cursor = None
    try:
        started_at = time.perf_counter()
        conn = conectar_firebird(conexao)
        cursor = conn.cursor()
        cursor.execute(sql_final, params)
        rows = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        data = [_json_safe(dict(zip(columns, row))) for row in rows]
        execution_ms = round((time.perf_counter() - started_at) * 1000, 2)
        return JsonResponse({
            'success': True,
            'columns': columns,
            'data': data,
            'count': len(data),
            'execution_ms': execution_ms,
            'filtered_by': ', '.join(filtered_fields) if filtered_fields else None,
            'message': f'{len(data)} registro(s) retornado(s).',
        })
    except Exception as e:
        return JsonResponse({'success': False, 'message': f'Erro ao executar SQL: {str(e)}'}, status=400)
    finally:
        try:
            if cursor:
                cursor.close()
        except Exception:
            pass
        try:
            if conn:
                conn.close()
        except Exception:
            pass


@login_required
def montar_rota(request):
    """Tela de montagem de rota a partir de pedidos Firebird"""
    pedidos = PedidoFirebird.objects.filter(usuario=request.user, importado=False).order_by('-data_importacao')
    rotas = Rota.objects.filter(usuario=request.user, ativo=True).order_by('-data_criacao')
    return render(request, 'rotas/montar_rota.html', {'pedidos': pedidos, 'rotas': rotas})


@login_required
def exportar_rota_pdf(request, pk):
    """Redireciona para seleção de layout para imprimir rota"""
    # Verificar se a rota existe e pertence ao usuário
    rota = get_object_or_404(Rota, pk=pk, usuario=request.user)
    
    # Redirecionar para página de seleção de layout
    from django.urls import reverse
    return redirect(reverse('rotas:rota_selecionar_layout', kwargs={'rota_id': pk}))


@login_required
def exportar_rota_csv(request, pk):
    """Exporta paradas de uma rota em CSV"""
    rota = get_object_or_404(Rota, pk=pk, usuario=request.user)
    paradas = rota.paradas.all().order_by('sequencia')
    
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="rota_{rota.id}.csv"'
    
    writer = csv.writer(response, delimiter=';')
    writer.writerow(['#', 'Cliente', 'Telefone', 'Endereço', 'Latitude', 'Longitude', 'Observações'])
    
    for parada in paradas:
        writer.writerow([
            parada.sequencia,
            parada.cliente_nome,
            parada.cliente_telefone or '',
            parada.endereco,
            parada.latitude,
            parada.longitude,
            parada.observacoes or ''
        ])
    
    return response


@login_required
@require_POST
def salvar_rota_mapa(request):
    """Salva uma rota a partir dos pontos do mapa"""
    try:
        data = json.loads(request.body)
        nome = data.get('nome', '').strip()
        rota_id = data.get('rota_id')  # ID da rota para atualizar (se reaberta)
        paradas_data = data.get('paradas', [])
        distancia_total = data.get('distancia_total')
        tempo_total = data.get('tempo_total')
        
        if not nome:
            return JsonResponse({'success': False, 'message': 'Nome da rota é obrigatório'}, status=400)
        
        if not paradas_data:
            return JsonResponse({'success': False, 'message': 'Adicione pelo menos uma parada'}, status=400)
        
        # Validar se pedidos já estão em outra rota (se configuração não permitir)
        config, _ = ConfiguracaoUsuario.objects.get_or_create(usuario=request.user)
        if not config.permitir_pedido_multiplas_rotas:
            pedido_ids_check = [p.get('pedido_firebird_id') for p in paradas_data if p.get('pedido_firebird_id')]
            if pedido_ids_check:
                # Excluir a própria rota da verificação (ao sobrescrever)
                pedidos_em_rota_qs = PedidoFirebird.objects.filter(
                    id__in=pedido_ids_check,
                    usuario=request.user,
                    importado=True,
                    rota__isnull=False,
                    rota__ativo=True
                ).select_related('rota')
                if rota_id:
                    pedidos_em_rota_qs = pedidos_em_rota_qs.exclude(rota_id=rota_id)
                if pedidos_em_rota_qs.exists():
                    nomes_conflito = [f'"{p.cliente_nome}" (Rota: {p.rota.nome})' for p in pedidos_em_rota_qs[:5]]
                    return JsonResponse({
                        'success': False,
                        'message': f'Os seguintes pedidos já estão em outra rota: {", ".join(nomes_conflito)}. Habilite "Permitir pedido em múltiplas rotas" nas configurações para permitir.'
                    }, status=400)
        
        # Verificar se é atualização de rota existente
        if rota_id:
            rota = get_object_or_404(Rota, pk=rota_id, usuario=request.user)
            rota.nome = nome
            rota.distancia_total = distancia_total
            rota.tempo_total = tempo_total
            rota.save()
            
            # Liberar pedidos antigos vinculados
            PedidoFirebird.objects.filter(rota=rota).update(rota=None, importado=False)
            
            # Remover paradas antigas
            rota.paradas.all().delete()
        else:
            # Criar nova rota
            rota = Rota.objects.create(
                usuario=request.user,
                nome=nome,
                distancia_total=distancia_total,
                tempo_total=tempo_total,
                status='planejamento'
            )
        
        # Criar as paradas e vincular pedidos Firebird
        pedido_ids = []
        for parada_data in paradas_data:
            Parada.objects.create(
                rota=rota,
                sequencia=parada_data.get('sequencia', 0),
                cliente_nome=parada_data.get('cliente_nome', 'Cliente'),
                endereco=parada_data.get('endereco', ''),
                latitude=parada_data.get('latitude', 0),
                longitude=parada_data.get('longitude', 0),
                observacoes=parada_data.get('observacoes', '')
            )
            # Coletar IDs de pedidos Firebird para vincular
            pedido_id = parada_data.get('pedido_firebird_id')
            if pedido_id:
                pedido_ids.append(pedido_id)
        
        # Vincular pedidos Firebird à rota
        if pedido_ids:
            PedidoFirebird.objects.filter(
                id__in=pedido_ids,
                usuario=request.user
            ).update(rota=rota, importado=True)
        
        return JsonResponse({
            'success': True,
            'message': f'Rota "{nome}" {"atualizada" if rota_id else "salva"} com sucesso!',
            'rota_id': rota.id
        })
        
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@login_required
@require_POST
def gerar_pdf_temporario(request):
    """Gera PDF a partir dos dados temporários do mapa sem salvar rota"""
    try:
        data = json.loads(request.body)
        nome = data.get('nome', 'Rota').strip()
        paradas_data = data.get('paradas', [])
        distancia_total = data.get('distancia_total')
        tempo_total = data.get('tempo_total')
        
        # Pegar configuração do usuário para campos personalizados
        config = ConfiguracaoUsuario.objects.filter(usuario=request.user).first()
        
        # Gerar PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        
        # Título
        story.append(Paragraph(f"<b>🚛 {nome}</b>", styles['Heading1']))
        story.append(Spacer(1, 0.2*inch))
        
        # Informações gerais
        info_data = [
            ['Data', f"{data.get('data', '')}".split('T')[0] if data.get('data') else time.strftime('%d/%m/%Y')],
            ['Distância Total', f"{distancia_total or '---'} km"],
            ['Tempo Total', f"{tempo_total or '---'} min"],
            ['Total de Paradas', str(len(paradas_data))],
        ]
        
        info_table = Table(info_data, colWidths=[1.5*inch, 4*inch])
        info_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Paradas
        story.append(Paragraph("<b>📍 Paradas</b>", styles['Heading2']))
        story.append(Spacer(1, 0.1*inch))
        
        paradas_table_data = [['#', 'Cliente', 'Endereço', 'Observações']]
        for parada in paradas_data:
            paradas_table_data.append([
                str(parada.get('sequencia', '')),
                parada.get('cliente_nome', ''),
                parada.get('endereco', ''),
                parada.get('observacoes', '')[:50] + ('...' if len(parada.get('observacoes', '')) > 50 else '')
            ])
        
        paradas_table = Table(paradas_table_data, colWidths=[0.4*inch, 1.8*inch, 2.5*inch, 1.5*inch])
        paradas_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4285F4')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
        ]))
        story.append(paradas_table)
        
        # Gerar PDF
        doc.build(story)
        
        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="rota_{time.strftime("%Y%m%d_%H%M%S")}.pdf"'
        
        return response
        
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@login_required
def gerar_pdf_rota(request, pk):
    """Redireciona para seleção de layout para imprimir rota"""
    # Verificar se a rota existe e pertence ao usuário
    rota = get_object_or_404(Rota, pk=pk, usuario=request.user)
    
    # Redirecionar para página de seleção de layout
    from django.urls import reverse
    return redirect(reverse('rotas:rota_selecionar_layout', kwargs={'rota_id': pk}))

@login_required
@ensure_csrf_cookie
def templates_pdf_list(request):
    """Lista templates PDF do usuário"""
    templates = TemplatePdf.objects.filter(usuario=request.user).order_by('-data_modificacao')
    return render(request, 'rotas/templates_pdf.html', {'templates': templates})


@login_required
def template_pdf_detail(request, pk):
    """Retorna detalhes de um template PDF (JSON)"""
    template = get_object_or_404(TemplatePdf, pk=pk, usuario=request.user)
    return JsonResponse({
        'id': template.id,
        'nome': template.nome,
        'ativo': template.ativo,
        'titulo_documento': template.titulo_documento,
        'mostrar_data': template.mostrar_data,
        'mostrar_distancia': template.mostrar_distancia,
        'mostrar_tempo': template.mostrar_tempo,
        'mostrar_total_paradas': template.mostrar_total_paradas,
        'cabecalho_personalizado': template.cabecalho_personalizado,
        'rodape_personalizado': template.rodape_personalizado,
        'cor_cabecalho_tabela': template.cor_cabecalho_tabela,
        'cor_fundo_linhas': template.cor_fundo_linhas,
        'campos_paradas': template.campos_paradas,
        'larguras_colunas': template.larguras_colunas,
    })


@login_required
@require_POST
def template_pdf_criar(request):
    """Cria um novo template PDF"""
    try:
        data = json.loads(request.body)
        
        template = TemplatePdf.objects.create(
            usuario=request.user,
            nome=data.get('nome'),
            ativo=data.get('ativo', True),
            titulo_documento=data.get('titulo_documento', '🚛 Rota de Entrega'),
            mostrar_data=data.get('mostrar_data', True),
            mostrar_distancia=data.get('mostrar_distancia', True),
            mostrar_tempo=data.get('mostrar_tempo', True),
            mostrar_total_paradas=data.get('mostrar_total_paradas', True),
            cabecalho_personalizado=data.get('cabecalho_personalizado', ''),
            rodape_personalizado=data.get('rodape_personalizado', ''),
            cor_cabecalho_tabela=data.get('cor_cabecalho_tabela', '#4285F4'),
            cor_fundo_linhas=data.get('cor_fundo_linhas', '#F5F5DC'),
            campos_paradas=data.get('campos_paradas', []),
            larguras_colunas=data.get('larguras_colunas', []),
        )
        
        return JsonResponse({'success': True, 'id': template.id})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@login_required
@require_POST
def template_pdf_editar(request, pk):
    """Edita um template PDF existente"""
    try:
        template = get_object_or_404(TemplatePdf, pk=pk, usuario=request.user)
        data = json.loads(request.body)
        
        template.nome = data.get('nome', template.nome)
        template.ativo = data.get('ativo', template.ativo)
        template.titulo_documento = data.get('titulo_documento', template.titulo_documento)
        template.mostrar_data = data.get('mostrar_data', template.mostrar_data)
        template.mostrar_distancia = data.get('mostrar_distancia', template.mostrar_distancia)
        template.mostrar_tempo = data.get('mostrar_tempo', template.mostrar_tempo)
        template.mostrar_total_paradas = data.get('mostrar_total_paradas', template.mostrar_total_paradas)
        template.cabecalho_personalizado = data.get('cabecalho_personalizado', template.cabecalho_personalizado)
        template.rodape_personalizado = data.get('rodape_personalizado', template.rodape_personalizado)
        template.cor_cabecalho_tabela = data.get('cor_cabecalho_tabela', template.cor_cabecalho_tabela)
        template.cor_fundo_linhas = data.get('cor_fundo_linhas', template.cor_fundo_linhas)
        template.campos_paradas = data.get('campos_paradas', template.campos_paradas)
        template.larguras_colunas = data.get('larguras_colunas', template.larguras_colunas)
        template.save()
        
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)


@login_required
@require_POST
def template_pdf_deletar(request, pk):
    """Deleta um template PDF"""
    try:
        template = get_object_or_404(TemplatePdf, pk=pk, usuario=request.user)
        template.delete()
        return JsonResponse({'success': True})
    except Exception as e:
        return JsonResponse({'success': False, 'message': str(e)}, status=500)
