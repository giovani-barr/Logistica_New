from django.contrib import admin
from rotas.models import (
    Rota, Parada, RotaHistorico, ConfiguracaoUsuario,
    ConexaoFirebird, QueryFirebird, PedidoFirebird, TemplatePdf,
    LayoutReport, ReportHistory
)


@admin.register(Rota)
class RotaAdmin(admin.ModelAdmin):
    list_display = ['nome', 'usuario', 'status', 'data_criacao', 'distancia_total', 'tempo_total']
    list_filter = ['status', 'data_criacao', 'usuario']
    search_fields = ['nome', 'descricao', 'usuario__username']
    readonly_fields = ['data_criacao', 'data_modificacao']
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('usuario', 'nome', 'descricao', 'status')
        }),
        ('Dados da Rota', {
            'fields': ('distancia_total', 'tempo_total', 'data_entrega')
        }),
        ('Controle', {
            'fields': ('observacoes', 'ativo', 'data_criacao', 'data_modificacao')
        }),
    )


@admin.register(Parada)
class ParadaAdmin(admin.ModelAdmin):
    list_display = ['sequencia', 'cliente_nome', 'rota', 'tipo', 'cidade']
    list_filter = ['rota', 'tipo', 'cidade']
    search_fields = ['cliente_nome', 'endereco', 'rota__nome']
    readonly_fields = ['data_criacao', 'data_modificacao']
    fieldsets = (
        ('Informações do Cliente', {
            'fields': ('cliente_nome', 'cliente_telefone', 'cliente_email')
        }),
        ('Endereço', {
            'fields': ('endereco', 'bairro', 'cidade', 'cep')
        }),
        ('Localização', {
            'fields': ('latitude', 'longitude')
        }),
        ('Rota', {
            'fields': ('rota', 'sequencia', 'tipo', 'tempo_estimado')
        }),
        ('Observações', {
            'fields': ('observacoes',)
        }),
        ('Datas', {
            'fields': ('data_criacao', 'data_modificacao')
        }),
    )


@admin.register(RotaHistorico)
class RotaHistoricoAdmin(admin.ModelAdmin):
    list_display = ['rota', 'usuario', 'acao', 'data_hora']
    list_filter = ['acao', 'data_hora', 'rota']
    search_fields = ['rota__nome', 'usuario__username', 'descricao']
    readonly_fields = ['data_hora', 'rota', 'usuario', 'acao', 'descricao']


@admin.register(ConfiguracaoUsuario)
class ConfiguracaoUsuarioAdmin(admin.ModelAdmin):
    list_display = ['usuario', 'nome_empresa', 'usar_otimizacao_automatica']
    list_filter = ['usar_otimizacao_automatica', 'permitir_compartilhamento']
    search_fields = ['usuario__username', 'nome_empresa']
    fieldsets = (
        ('Usuário', {
            'fields': ('usuario',)
        }),
        ('Empresa', {
            'fields': ('nome_empresa', 'telefone_empresa', 'email_empresa')
        }),
        ('Localização Padrão', {
            'fields': ('localizacao_padrao_lat', 'localizacao_padrao_lng')
        }),
        ('Preferências', {
            'fields': ('usar_otimizacao_automatica', 'permitir_compartilhamento')
        }),
    )


@admin.register(ConexaoFirebird)
class ConexaoFirebirdAdmin(admin.ModelAdmin):
    list_display = ['nome_conexao', 'host', 'porta', 'usuario', 'ativo', 'testado']
    list_filter = ['ativo', 'testado', 'data_criacao']
    search_fields = ['nome_conexao', 'host', 'usuario__username']
    readonly_fields = ['data_criacao', 'data_modificacao']
    fieldsets = (
        ('Conexão', {
            'fields': ('usuario', 'nome_conexao', 'ativo')
        }),
        ('Servidor Firebird', {
            'fields': ('host', 'porta', 'caminho_banco', 'usuario_banco', 'charset')
        }),
        ('Status', {
            'fields': ('testado', 'data_criacao', 'data_modificacao')
        }),
    )


@admin.register(QueryFirebird)
class QueryFirebirdAdmin(admin.ModelAdmin):
    list_display = ['nome_query', 'usuario', 'conexao', 'campo_pedido', 'ativo']
    list_filter = ['ativo', 'conexao', 'data_criacao']
    search_fields = ['nome_query', 'usuario__username', 'descricao']
    readonly_fields = ['data_criacao', 'data_modificacao']
    fieldsets = (
        ('Informações', {
            'fields': ('usuario', 'conexao', 'nome_query', 'descricao', 'ativo')
        }),
        ('SQL', {
            'fields': ('sql',)
        }),
        ('Mapeamento de Campos', {
            'fields': (
                'campo_pedido', 'campo_cliente', 'campo_entregador',
                'campo_latitude', 'campo_longitude', 'campo_descricao',
                'campo_endereco', 'campo_telefone', 'campo_email'
            )
        }),
        ('Datas', {
            'fields': ('data_criacao', 'data_modificacao')
        }),
    )


@admin.register(PedidoFirebird)
class PedidoFirebirdAdmin(admin.ModelAdmin):
    list_display = ['numero_pedido', 'cliente_nome', 'usuario', 'importado', 'rota']
    list_filter = ['importado', 'query', 'data_importacao']
    search_fields = ['numero_pedido', 'cliente_nome', 'usuario__username']
    readonly_fields = ['data_importacao', 'data_modificacao', 'dados_json']
    fieldsets = (
        ('Informações do Pedido', {
            'fields': ('usuario', 'query', 'numero_pedido', 'cliente_nome')
        }),
        ('Detalhes', {
            'fields': ('entregador', 'descricao', 'endereco', 'telefone', 'email')
        }),
        ('Localização', {
            'fields': ('latitude', 'longitude')
        }),
        ('Importação', {
            'fields': ('importado', 'rota', 'data_importacao', 'data_modificacao')
        }),
        ('Dados Originais', {
            'fields': ('dados_json',),
            'classes': ('collapse',)
        }),
    )


@admin.register(TemplatePdf)
class TemplatePdfAdmin(admin.ModelAdmin):
    list_display = ['nome', 'usuario', 'ativo', 'data_modificacao']
    list_filter = ['ativo', 'usuario']
    search_fields = ['nome', 'usuario__username']
    readonly_fields = ['data_criacao', 'data_modificacao']
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('usuario', 'nome', 'ativo')
        }),
        ('Configurações do Documento', {
            'fields': (
                'titulo_documento',
                'mostrar_data',
                'mostrar_distancia',
                'mostrar_tempo',
                'mostrar_total_paradas'
            )
        }),
        ('Personalização', {
            'fields': ('cabecalho_personalizado', 'rodape_personalizado')
        }),
        ('Cores', {
            'fields': ('cor_cabecalho_tabela', 'cor_fundo_linhas')
        }),
        ('Campos da Tabela', {
            'fields': ('campos_paradas', 'larguras_colunas', 'campos_sql_extras'),
            'description': 'Configure quais campos exibir na tabela de paradas'
        }),
        ('Datas', {
            'fields': ('data_criacao', 'data_modificacao')
        }),
    )


@admin.register(LayoutReport)
class LayoutReportAdmin(admin.ModelAdmin):
    list_display = ['nome', 'usuario', 'padrao', 'page_size', 'orientation', 'data_modificacao']
    list_filter = ['padrao', 'page_size', 'orientation', 'usuario']
    search_fields = ['nome', 'descricao', 'usuario__username']
    readonly_fields = ['data_criacao', 'data_modificacao']
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('usuario', 'nome', 'descricao', 'padrao')
        }),
        ('Configurações da Página', {
            'fields': ('page_size', 'orientation', 'margin_top', 'margin_bottom', 'margin_left', 'margin_right')
        }),
        ('Fonte e Estilo', {
            'fields': ('fonte_padrao', 'tamanho_fonte_padrao')
        }),
        ('Layout JSON', {
            'fields': ('layout_json',),
            'classes': ('collapse',),
            'description': 'Estrutura JSON com bandas e elementos'
        }),
        ('Datas', {
            'fields': ('data_criacao', 'data_modificacao')
        }),
    )


@admin.register(ReportHistory)
class ReportHistoryAdmin(admin.ModelAdmin):
    list_display = ['layout', 'usuario', 'data_geracao', 'formato', 'total_registros']
    list_filter = ['formato', 'data_geracao']
    search_fields = ['layout__nome', 'usuario__username']
    readonly_fields = ['data_geracao', 'layout', 'usuario', 'formato', 'total_registros', 'total_paginas', 'tempo_geracao']
    
    def has_add_permission(self, request):
        # Histórico não deve ser criado manualmente
        return False
    
    def has_delete_permission(self, request, obj=None):
        # Permitir deletar históricos antigos
        return True
