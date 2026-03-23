from django.urls import path
from . import views
from . import views_firebird
from . import views_report

app_name = 'rotas'

urlpatterns = [
    path('', views.index, name='index'),
    path('montar-rota/', views.montar_rota, name='montar_rota'),
    path('rotas/nomes-fixos/', views.listar_nomes_fixos_rota, name='listar_nomes_fixos_rota'),
    path('rotas/nomes-fixos/salvar/', views.salvar_nome_fixo_rota, name='salvar_nome_fixo_rota'),
    path('rotas/nomes-fixos/<int:pk>/deletar/', views.deletar_nome_fixo_rota, name='deletar_nome_fixo_rota'),
    path('rotas/', views.lista_rotas, name='lista_rotas'),
    path('rotas/criar/', views.criar_rota, name='criar_rota'),
    path('rotas/<int:pk>/', views.detalhe_rota, name='detalhe_rota'),
    path('rotas/<int:pk>/editar/', views.editar_rota, name='editar_rota'),
    path('rotas/<int:pk>/deletar/', views.deletar_rota, name='deletar_rota'),
    path('rotas/<int:pk>/reabrir/', views.reabrir_rota, name='reabrir_rota'),
    path('rotas/<int:pk>/pdf/', views.exportar_rota_pdf, name='exportar_pdf'),
    path('rotas/<int:pk>/csv/', views.exportar_rota_csv, name='exportar_csv'),
    path('rotas/salvar-mapa/', views.salvar_rota_mapa, name='salvar_rota_mapa'),
    path('rotas/pdf-temporario/', views.gerar_pdf_temporario, name='gerar_pdf_temporario'),
    path('pdf/<int:pk>/', views.gerar_pdf_rota, name='gerar_pdf_rota'),
    path('templates-pdf/', views.templates_pdf_list, name='templates_pdf_list'),
    path('templates-pdf/criar/', views.template_pdf_criar, name='template_pdf_criar'),
    path('templates-pdf/<int:pk>/', views.template_pdf_detail, name='template_pdf_detail'),
    path('templates-pdf/<int:pk>/editar/', views.template_pdf_editar, name='template_pdf_editar'),
    path('templates-pdf/<int:pk>/deletar/', views.template_pdf_deletar, name='template_pdf_deletar'),
    path('configuracao/', views.configuracao_usuario, name='configuracao_usuario'),
    path('configuracao/campos-pedidos/salvar-index/', views.salvar_campos_card_index, name='salvar_campos_card_index'),
    path('configuracao/campos-pedidos/salvar-sql-index/', views.salvar_sql_card_index, name='salvar_sql_card_index'),
    path('configuracao/campos-pedidos/testar-sql-index/', views.testar_sql_card_index, name='testar_sql_card_index'),
    path('configuracao/campos-pedidos/editor-sql/', views.editor_sql_page, name='editor_sql_page'),
    path('configuracao/rotas/salvar-visual/', views.salvar_config_visual_rotas, name='salvar_config_visual_rotas'),
    path('configuracao/rotas/busca-endereco/salvar/', views.salvar_config_busca_endereco, name='salvar_config_busca_endereco'),
    path('configuracao/rotas-ocultas/salvar/', views.salvar_rotas_ocultas, name='salvar_rotas_ocultas'),
    path('configuracao/filtros-exclusao/salvar/', views.salvar_filtros_exclusao, name='salvar_filtros_exclusao'),
    path('configuracao/arquivamento/salvar/', views.salvar_regras_arquivamento, name='salvar_regras_arquivamento'),
    path('configuracao/arquivamento/executar/', views.executar_arquivamento_agora, name='executar_arquivamento_agora'),
    path('configuracao/quarentena/executar/', views.executar_quarentena_agora, name='executar_quarentena_agora'),
    path('pedidos/historico-exclusoes/', views.historico_exclusoes, name='historico_exclusoes'),
    path('pedidos/historico-exclusoes/csv/', views.historico_exclusoes_csv, name='historico_exclusoes_csv'),

    # SQLs Extra (AJAX endpoints – gerenciados via Editor SQL)
    path('firebird/sqls-extra/salvar/', views.sqls_extra_salvar, name='sqls_extra_salvar'),
    path('firebird/sqls-extra/testar/', views.sqls_extra_testar, name='sqls_extra_testar'),
    path('firebird/sqls-extra/<int:pk>/', views.sqls_extra_get, name='sqls_extra_get'),
    path('firebird/sqls-extra/<int:pk>/deletar/', views.sqls_extra_deletar, name='sqls_extra_deletar'),
    
    # Campos disponíveis para ligação (AJAX)
    path('firebird/campos-disponiveis/', views.campos_disponiveis, name='campos_disponiveis'),

    # Raio X do Cliente (AJAX)
    path('firebird/raio-x/sqls/', views.raio_x_listar_sqls, name='raio_x_listar_sqls'),
    path('firebird/raio-x/executar/', views.raio_x_executar_sql, name='raio_x_executar_sql'),
    path('firebird/raio-x/abas/', views.raio_x_abas_listar, name='raio_x_abas_listar'),
    path('firebird/raio-x/abas/salvar/', views.raio_x_abas_salvar, name='raio_x_abas_salvar'),
    
    # URLs do Firebird
    path('firebird/conexao/', views_firebird.conexao_firebird_view, name='conexao_firebird'),
    path('firebird/conexao/test/', views_firebird.test_conexao_firebird, name='test_conexao_firebird'),
    path('firebird/importar/', views_firebird.importar_pedidos, name='importar_pedidos'),
    path('firebird/importar/async/', views_firebird.importar_pedidos_async, name='importar_pedidos_async'),
    path('firebird/pedidos/', views_firebird.pedidos_firebird_list, name='pedidos_firebird_list'),
    path('firebird/rotas/criar/', views_firebird.criar_rota_de_pedidos, name='criar_rota_de_pedidos'),
    path('firebird/pedidos/<int:pk>/coordenadas/', views_firebird.atualizar_coordenadas_pedido, name='atualizar_coordenadas_pedido'),
    path('firebird/pedidos/<int:pk>/converter/', views_firebird.converter_pedido_para_parada, name='converter_pedido'),
    path('firebird/pedidos/<int:pk>/arquivar/', views_firebird.arquivar_pedido, name='arquivar_pedido'),
    
    # URLs do Editor de Layout de Relatórios
    path('report-designer/', views_report.report_designer_list, name='report_designer_list'),
    path('report-designer/novo/', views_report.report_designer_editor, name='report_designer_new'),
    path('report-designer/<int:pk>/editar/', views_report.report_designer_editor, name='report_designer_editor'),
    path('report-designer/salvar/', views_report.report_designer_save, name='report_designer_save'),
    path('report-designer/<int:pk>/deletar/', views_report.report_designer_delete, name='report_designer_delete'),
    path('report-designer/<int:pk>/duplicar/', views_report.report_designer_duplicate, name='report_designer_duplicate'),
    path('report-designer/load-fields/', views_report.report_designer_load_fields, name='report_designer_load_fields'),
    path('report-designer/preview/', views_report.report_designer_preview, name='report_designer_preview'),
    path('report-designer/<int:pk>/gerar/', views_report.report_designer_generate, name='report_designer_generate'),
    path('report-designer/<int:pk>/export/', views_report.report_designer_export, name='report_designer_export'),
    path('report-designer/export/', views_report.report_designer_export_format, name='report_designer_export_format'),
    path('report-designer/import/', views_report.report_designer_import, name='report_designer_import'),
    
    # Integração Rotas + Layouts
    path('rotas/<int:rota_id>/layout-selector/', views_report.rota_selecionar_layout, name='rota_selecionar_layout'),
    path('rotas/<int:rota_id>/pdf-layout/<int:layout_id>/', views_report.rota_gerar_pdf_com_layout, name='rota_gerar_pdf_com_layout'),
    path('rotas/<int:rota_id>/preview-layout/<int:layout_id>/', views_report.rota_preview_layout, name='rota_preview_layout'),
]
