from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


class Rota(models.Model):
    STATUS_CHOICES = [
        ('planejamento', 'Planejamento'),
        ('em_andamento', 'Em Andamento'),
        ('concluída', 'Concluída'),
        ('cancelada', 'Cancelada'),
    ]
    
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='rotas')
    nome = models.CharField(max_length=255, verbose_name='Nome da Rota')
    descricao = models.TextField(blank=True, null=True, verbose_name='Descrição')
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name='Data de Criação')
    data_modificacao = models.DateTimeField(auto_now=True, verbose_name='Última Modificação')
    data_entrega = models.DateField(blank=True, null=True, verbose_name='Data de Entrega')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planejamento', verbose_name='Status')
    distancia_total = models.FloatField(blank=True, null=True, validators=[MinValueValidator(0)], verbose_name='Distância Total (km)')
    tempo_total = models.IntegerField(blank=True, null=True, validators=[MinValueValidator(0)], verbose_name='Tempo Total (min)')
    observacoes = models.TextField(blank=True, null=True, verbose_name='Observações Gerais')
    ativo = models.BooleanField(default=True, verbose_name='Ativo')
    
    class Meta:
        ordering = ['-data_criacao']
        verbose_name = 'Rota'
        verbose_name_plural = 'Rotas'
        indexes = [
            models.Index(fields=['usuario', '-data_criacao']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"{self.nome} - {self.get_status_display()}"


class Parada(models.Model):
    TIPO_CHOICES = [
        ('coleta', 'Coleta'),
        ('entrega', 'Entrega'),
        ('devolução', 'Devolução'),
        ('transferência', 'Transferência'),
    ]
    
    rota = models.ForeignKey(Rota, on_delete=models.CASCADE, related_name='paradas')
    sequencia = models.PositiveIntegerField(verbose_name='Sequência', default=0)
    cliente_nome = models.CharField(max_length=255, verbose_name='Nome do Cliente')
    cliente_telefone = models.CharField(max_length=20, blank=True, null=True, verbose_name='Telefone')
    cliente_email = models.EmailField(blank=True, null=True, verbose_name='Email')
    endereco = models.CharField(max_length=500, verbose_name='Endereço')
    bairro = models.CharField(max_length=100, blank=True, null=True, verbose_name='Bairro')
    cidade = models.CharField(max_length=100, blank=True, null=True, verbose_name='Cidade')
    cep = models.CharField(max_length=20, blank=True, null=True, verbose_name='CEP')
    latitude = models.FloatField(verbose_name='Latitude')
    longitude = models.FloatField(verbose_name='Longitude')
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='entrega', verbose_name='Tipo')
    observacoes = models.TextField(blank=True, null=True, verbose_name='Observações')
    tempo_estimado = models.IntegerField(blank=True, null=True, validators=[MinValueValidator(0)], verbose_name='Tempo Estimado (min)')
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name='Data de Criação')
    data_modificacao = models.DateTimeField(auto_now=True, verbose_name='Última Modificação')
    
    class Meta:
        ordering = ['rota', 'sequencia']
        verbose_name = 'Parada'
        verbose_name_plural = 'Paradas'
        indexes = [
            models.Index(fields=['rota', 'sequencia']),
        ]
        unique_together = ['rota', 'sequencia']
    
    def __str__(self):
        return f"{self.cliente_nome} - {self.rota.nome}"


class RotaHistorico(models.Model):
    rota = models.ForeignKey(Rota, on_delete=models.CASCADE, related_name='historicos')
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    acao = models.CharField(max_length=50, verbose_name='Ação')
    descricao = models.TextField(verbose_name='Descrição')
    data_hora = models.DateTimeField(auto_now_add=True, verbose_name='Data e Hora')
    
    class Meta:
        ordering = ['-data_hora']
        verbose_name = 'Histórico de Rota'
        verbose_name_plural = 'Históricos de Rotas'
    
    def __str__(self):
        return f"{self.rota.nome} - {self.acao}"


class ConfiguracaoUsuario(models.Model):
    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='configuracao_logistica')
    localizacao_padrao_lat = models.FloatField(default=0.034987, verbose_name='Latitude Padrão')
    localizacao_padrao_lng = models.FloatField(default=-51.074846, verbose_name='Longitude Padrão')
    ponto_partida_lat = models.FloatField(default=0.034987, verbose_name='Ponto de Partida - Latitude')
    ponto_partida_lng = models.FloatField(default=-51.074846, verbose_name='Ponto de Partida - Longitude')
    ponto_partida_nome = models.CharField(max_length=100, blank=True, default='', verbose_name='Ponto de Partida - Nome')
    ponto_final_lat = models.FloatField(default=0.034987, verbose_name='Ponto Final - Latitude')
    ponto_final_lng = models.FloatField(default=-51.074846, verbose_name='Ponto Final - Longitude')
    ponto_final_nome = models.CharField(max_length=100, blank=True, default='', verbose_name='Ponto Final - Nome')
    ponto_partida_ativo = models.BooleanField(default=False, verbose_name='Usar Ponto de Partida Fixo')
    ponto_final_ativo = models.BooleanField(default=False, verbose_name='Usar Ponto Final Fixo')
    nome_empresa = models.CharField(max_length=255, default='FERMAP Logística', verbose_name='Nome da Empresa')
    telefone_empresa = models.CharField(max_length=20, blank=True, null=True, verbose_name='Telefone Empresa')
    email_empresa = models.EmailField(blank=True, null=True, verbose_name='Email Empresa')
    usar_otimizacao_automatica = models.BooleanField(default=True, verbose_name='Otimização Automática')
    otimizacao_motor = models.CharField(
        max_length=10,
        choices=[('local', 'Local (B&B)'), ('vroom', 'Vroom'), ('ors', 'OpenRouteService')],
        default='local',
        verbose_name='Motor de Otimização'
    )
    ors_api_key = models.CharField(max_length=200, blank=True, default='', verbose_name='Chave API OpenRouteService')
    google_maps_api_key = models.CharField(max_length=255, blank=True, default='', verbose_name='Chave API Google Maps')
    google_maps_search_country = models.CharField(max_length=10, blank=True, default='br', verbose_name='País padrão da busca Google Maps')
    permitir_compartilhamento = models.BooleanField(default=False, verbose_name='Permitir Compartilhamento')
    campos_exibicao_pedidos = models.JSONField(default=list, blank=True, verbose_name='Campos de Exibição dos Pedidos')
    pedidos_card_regras_cor = models.JSONField(default=list, blank=True, verbose_name='Regras de Cor dos Cards')
    campos_exibicao_rotas = models.JSONField(default=list, blank=True, verbose_name='Campos de Exibição dos Cards de Rota')
    rotas_card_regras_cor = models.JSONField(default=list, blank=True, verbose_name='Regras de Cor dos Cards de Rota')
    pedidos_card_cor_fundo = models.CharField(max_length=20, default='#ffffff', verbose_name='Cor de Fundo do Card')
    pedidos_card_cor_borda = models.CharField(max_length=20, default='#e0e0e0', verbose_name='Cor da Borda do Card')
    pedidos_card_tamanho_fonte = models.IntegerField(default=12, verbose_name='Tamanho da Fonte do Card')
    pedidos_card_padding = models.IntegerField(default=8, verbose_name='Padding do Card')
    pedidos_card_raio = models.IntegerField(default=8, verbose_name='Raio da Borda do Card')
    pedidos_card_padding_vertical = models.IntegerField(default=8, verbose_name='Padding Vertical do Card')
    pedidos_card_padding_horizontal = models.IntegerField(default=8, verbose_name='Padding Horizontal do Card')
    pedidos_panel_largura = models.IntegerField(default=320, verbose_name='Largura do Painel de Pedidos (px)')
    permitir_pedidos_sem_coordenadas = models.BooleanField(default=True, verbose_name='Permitir pedidos sem coordenadas na rota')
    permitir_pedido_multiplas_rotas = models.BooleanField(default=False, verbose_name='Permitir mesmo pedido em múltiplas rotas')
    
    # Configurações dos cards de rota (stop-items)
    rotas_card_cor_fundo = models.CharField(max_length=20, default='#ffffff', verbose_name='Cor de Fundo do Card de Rota')
    rotas_card_cor_borda = models.CharField(max_length=20, default='#dadce0', verbose_name='Cor da Borda do Card de Rota')
    rotas_card_tamanho_fonte = models.IntegerField(default=13, verbose_name='Tamanho da Fonte do Card de Rota')
    rotas_card_padding_vertical = models.IntegerField(default=12, verbose_name='Padding Vertical do Card de Rota')
    rotas_card_padding_horizontal = models.IntegerField(default=12, verbose_name='Padding Horizontal do Card de Rota')
    rotas_card_raio = models.IntegerField(default=8, verbose_name='Raio da Borda do Card de Rota')
    rotas_card_mostrar_numero = models.BooleanField(default=True, verbose_name='Mostrar Número da Sequência')
    rotas_card_mostrar_endereco = models.BooleanField(default=True, verbose_name='Mostrar Endereço')
    rotas_card_mostrar_obs = models.BooleanField(default=True, verbose_name='Mostrar Observações')
    rotas_card_cor_numero = models.CharField(max_length=20, default='#4285F4', verbose_name='Cor do Número da Sequência')
    rotas_ocultas = models.JSONField(default=list, blank=True, verbose_name='Rotas Ocultas do Painel de Pedidos')
    filtros_exclusao_pedidos = models.JSONField(default=list, blank=True, verbose_name='Filtros de Exclusão de Pedidos')

    class Meta:
        verbose_name = 'Configuração de Usuário'
        verbose_name_plural = 'Configurações de Usuários'
    
    def __str__(self):
        return f"Configuração - {self.usuario.username}"


class NomeFixoRota(models.Model):
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='nomes_fixos_rota')
    nome = models.CharField(max_length=80, verbose_name='Nome da Rota')
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_modificacao = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Nome Fixo de Rota'
        verbose_name_plural = 'Nomes Fixos de Rota'
        ordering = ['nome']
        unique_together = ['usuario', 'nome']
        indexes = [
            models.Index(fields=['usuario', 'nome']),
        ]

    def save(self, *args, **kwargs):
        self.nome = (self.nome or '').strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.nome} - {self.usuario.username}"


class ConexaoFirebird(models.Model):
    """Armazena as configurações de conexão com o banco Firebird"""
    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='conexao_firebird')
    nome_conexao = models.CharField(max_length=255, verbose_name='Nome da Conexão')
    host = models.CharField(max_length=255, verbose_name='Host/Servidor', help_text='IP ou nome do servidor')
    porta = models.IntegerField(default=3050, verbose_name='Porta')
    caminho_banco = models.CharField(max_length=500, verbose_name='Caminho do Banco', help_text='Ex: C:\\Firebird\\database.fdb ou /home/user/database.fdb')
    usuario_banco = models.CharField(max_length=100, verbose_name='Usuário Firebird', default='SYSDBA')
    senha_banco = models.CharField(max_length=255, verbose_name='Senha Firebird')
    charset = models.CharField(max_length=50, default='UTF8', verbose_name='Charset')
    ativo = models.BooleanField(default=True, verbose_name='Ativo')
    testado = models.BooleanField(default=False, verbose_name='Conexão Testada')
    importacao_automatica = models.BooleanField(default=False, verbose_name='Importação automática')
    importacao_intervalo_segundos = models.IntegerField(
        default=120,
        validators=[MinValueValidator(30), MaxValueValidator(21600)],
        verbose_name='Intervalo da importação automática (segundos)'
    )
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_modificacao = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Conexão Firebird'
        verbose_name_plural = 'Conexões Firebird'
    
    def __str__(self):
        return f"{self.nome_conexao} - {self.host}"


class QueryFirebird(models.Model):
    """Armazena as queries SQL para importar dados do Firebird"""
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='queries_firebird')
    conexao = models.ForeignKey(ConexaoFirebird, on_delete=models.CASCADE, related_name='queries')
    nome_query = models.CharField(max_length=255, verbose_name='Nome da Query')
    descricao = models.TextField(blank=True, null=True, verbose_name='Descrição')
    sql = models.TextField(verbose_name='SQL Query', help_text='Query SQL para buscar pedidos e clientes')
    
    # Mapeamento de campos
    campo_pedido = models.CharField(max_length=100, verbose_name='Campo: Número do Pedido', help_text='Nome da coluna no resultado')
    campo_cliente = models.CharField(max_length=100, verbose_name='Campo: Nome do Cliente', help_text='Nome da coluna no resultado')
    campo_entregador = models.CharField(max_length=100, blank=True, null=True, verbose_name='Campo: Entregador', help_text='Nome da coluna no resultado (opcional)')
    campo_latitude = models.CharField(max_length=100, verbose_name='Campo: Latitude', help_text='Nome da coluna no resultado')
    campo_longitude = models.CharField(max_length=100, verbose_name='Campo: Longitude', help_text='Nome da coluna no resultado')
    campo_descricao = models.CharField(max_length=100, blank=True, null=True, verbose_name='Campo: Descrição', help_text='Nome da coluna no resultado (opcional)')
    campo_endereco = models.CharField(max_length=100, blank=True, null=True, verbose_name='Campo: Endereço')
    campo_telefone = models.CharField(max_length=100, blank=True, null=True, verbose_name='Campo: Telefone')
    campo_email = models.CharField(max_length=100, blank=True, null=True, verbose_name='Campo: Email')
    
    ativo = models.BooleanField(default=True, verbose_name='Ativo')
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_modificacao = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Query Firebird'
        verbose_name_plural = 'Queries Firebird'
    
    def __str__(self):
        return f"{self.nome_query}"


class PedidoFirebird(models.Model):
    """Armazena os pedidos importados do Firebird"""
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pedidos_firebird')
    query = models.ForeignKey(QueryFirebird, on_delete=models.CASCADE, related_name='pedidos')
    numero_pedido = models.CharField(max_length=100, verbose_name='Número do Pedido')
    cliente_nome = models.CharField(max_length=255, verbose_name='Nome do Cliente')
    entregador = models.CharField(max_length=255, blank=True, null=True, verbose_name='Entregador')
    latitude = models.FloatField(verbose_name='Latitude', null=True, blank=True)
    longitude = models.FloatField(verbose_name='Longitude', null=True, blank=True)
    descricao = models.TextField(blank=True, null=True, verbose_name='Descrição')
    endereco = models.CharField(max_length=500, blank=True, null=True, verbose_name='Endereço')
    telefone = models.CharField(max_length=20, blank=True, null=True, verbose_name='Telefone')
    email = models.EmailField(blank=True, null=True, verbose_name='Email')
    
    # Dados adicionais
    dados_json = models.JSONField(default=dict, blank=True, verbose_name='Dados Completos')
    importado = models.BooleanField(default=False, verbose_name='Importado para Rota')
    arquivado = models.BooleanField(default=False, verbose_name='Arquivado')
    motivo_arquivo = models.CharField(max_length=255, blank=True, null=True, verbose_name='Motivo do Arquivo')
    data_arquivamento = models.DateTimeField(null=True, blank=True, verbose_name='Data de Arquivamento')
    dias_quarentena_arquivo = models.PositiveIntegerField(null=True, blank=True, verbose_name='Dias de Quarentena')
    rota = models.ForeignKey(Rota, on_delete=models.SET_NULL, null=True, blank=True, related_name='pedidos_firebird')
    
    data_importacao = models.DateTimeField(auto_now_add=True)
    data_modificacao = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Pedido Firebird'
        verbose_name_plural = 'Pedidos Firebird'
        unique_together = ['usuario', 'numero_pedido', 'query']
    
    def __str__(self):
        return f"Pedido {self.numero_pedido} - {self.cliente_nome}"


class TemplatePdf(models.Model):
    """Template personalizável para geração de PDFs de rotas"""
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='templates_pdf')
    nome = models.CharField(max_length=255, verbose_name='Nome do Template')
    ativo = models.BooleanField(default=True, verbose_name='Ativo')
    
    # Configurações do documento
    titulo_documento = models.CharField(max_length=255, default='🚛 Rota de Entrega', verbose_name='Título do Documento')
    mostrar_data = models.BooleanField(default=True, verbose_name='Mostrar Data')
    mostrar_distancia = models.BooleanField(default=True, verbose_name='Mostrar Distância')
    mostrar_tempo = models.BooleanField(default=True, verbose_name='Mostrar Tempo')
    mostrar_total_paradas = models.BooleanField(default=True, verbose_name='Mostrar Total de Paradas')
    
    # Cabeçalho e rodapé
    cabecalho_personalizado = models.TextField(blank=True, null=True, verbose_name='Cabeçalho Personalizado')
    rodape_personalizado = models.TextField(blank=True, null=True, verbose_name='Rodapé Personalizado')
    
    # Configuração de cores (hex)
    cor_cabecalho_tabela = models.CharField(max_length=7, default='#4285F4', verbose_name='Cor do Cabeçalho da Tabela')
    cor_fundo_linhas = models.CharField(max_length=7, default='#F5F5DC', verbose_name='Cor de Fundo das Linhas')
    
    # Campos da tabela de paradas (lista de campos a exibir)
    campos_paradas = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Campos das Paradas',
        help_text='Lista de campos a exibir: sequencia, cliente_nome, endereco, telefone, observacoes, etc.'
    )
    
    # Configuração de larguras das colunas (proporções)
    larguras_colunas = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Larguras das Colunas',
        help_text='Lista de larguras proporcionais para cada coluna'
    )
    
    # Campos adicionais do SQL (para exibir dados personalizados dos pedidos)
    campos_sql_extras = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Campos SQL Extras',
        help_text='Campos adicionais do SQL a serem exibidos'
    )
    
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_modificacao = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Template PDF'
        verbose_name_plural = 'Templates PDF'
        ordering = ['-data_modificacao']
    
    def __str__(self):
        return f"{self.nome} - {self.usuario.username}"


# ===== EDITOR DE LAYOUT DE RELATÓRIOS (TIPO FASTREPORT) =====

class LayoutReport(models.Model):
    """Template de layout de relatório com sistema de bandas"""
    
    ORIENTATION_CHOICES = [
        ('portrait', 'Retrato'),
        ('landscape', 'Paisagem'),
    ]
    
    PAGE_SIZE_CHOICES = [
        ('A4', 'A4 (210mm x 297mm)'),
        ('Letter', 'Letter (8.5" x 11")'),
        ('Legal', 'Legal (8.5" x 14")'),
        ('A3', 'A3 (297mm x 420mm)'),
        ('A5', 'A5 (148mm x 210mm)'),
    ]
    
    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='layout_reports')
    nome = models.CharField(max_length=255, verbose_name='Nome do Layout')
    descricao = models.TextField(blank=True, null=True, verbose_name='Descrição')
    ativo = models.BooleanField(default=True, verbose_name='Ativo')
    padrao = models.BooleanField(default=False, verbose_name='Usar como Padrão')
    
    # Configurações da página
    page_size = models.CharField(max_length=20, choices=PAGE_SIZE_CHOICES, default='A4', verbose_name='Tamanho da Página')
    orientation = models.CharField(max_length=20, choices=ORIENTATION_CHOICES, default='portrait', verbose_name='Orientação')
    margin_top = models.FloatField(default=20.0, validators=[MinValueValidator(0)], verbose_name='Margem Superior (mm)')
    margin_bottom = models.FloatField(default=20.0, validators=[MinValueValidator(0)], verbose_name='Margem Inferior (mm)')
    margin_left = models.FloatField(default=15.0, validators=[MinValueValidator(0)], verbose_name='Margem Esquerda (mm)')
    margin_right = models.FloatField(default=15.0, validators=[MinValueValidator(0)], verbose_name='Margem Direita (mm)')
    
    # Fonte padrão
    default_font_family = models.CharField(max_length=100, default='Helvetica', verbose_name='Fonte Padrão')
    default_font_size = models.IntegerField(default=10, validators=[MinValueValidator(1)], verbose_name='Tamanho da Fonte Padrão')
    
    # Configuração de bandas e elementos (JSON estruturado)
    layout_json = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Configuração do Layout',
        help_text='Estrutura JSON com bandas e elementos'
    )
    
    # Query/Fonte de dados associada
    query = models.ForeignKey(
        QueryFirebird,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='layouts',
        verbose_name='Query de Dados'
    )
    
    # Metadados
    data_criacao = models.DateTimeField(auto_now_add=True, verbose_name='Data de Criação')
    data_modificacao = models.DateTimeField(auto_now=True, verbose_name='Última Modificação')
    versao = models.IntegerField(default=1, verbose_name='Versão')
    
    class Meta:
        verbose_name = 'Layout de Relatório'
        verbose_name_plural = 'Layouts de Relatórios'
        ordering = ['-data_modificacao']
        indexes = [
            models.Index(fields=['usuario', 'ativo']),
            models.Index(fields=['padrao']),
        ]
    
    def __str__(self):
        return f"{self.nome} - {self.usuario.username}"
    
    def get_layout_structure(self):
        """Retorna a estrutura do layout ou cria uma estrutura padrão"""
        if not self.layout_json:
            return self._get_default_structure()
        return self.layout_json
    
    def _get_default_structure(self):
        """Estrutura padrão do layout com bandas básicas"""
        return {
            "bands": [
                {
                    "id": "page_header",
                    "type": "page_header",
                    "name": "Cabeçalho de Página",
                    "height": 80,
                    "visible": True,
                    "print_on_first_page": True,
                    "background_color": "",
                    "elements": []
                },
                {
                    "id": "header",
                    "type": "header",
                    "name": "Cabeçalho do Relatório",
                    "height": 60,
                    "visible": True,
                    "background_color": "",
                    "elements": []
                },
                {
                    "id": "group_header",
                    "type": "group_header",
                    "name": "Cabeçalho de Grupo",
                    "height": 40,
                    "visible": False,
                    "group_by_field": "",
                    "background_color": "#f5f5f5",
                    "elements": []
                },
                {
                    "id": "detail",
                    "type": "detail",
                    "name": "Detalhe",
                    "height": 30,
                    "visible": True,
                    "alternating_color": True,
                    "background_color": "#ffffff",
                    "alternate_color": "#f9f9f9",
                    "elements": []
                },
                {
                    "id": "group_footer",
                    "type": "group_footer",
                    "name": "Rodapé de Grupo",
                    "height": 40,
                    "visible": False,
                    "background_color": "#f5f5f5",
                    "elements": []
                },
                {
                    "id": "footer",
                    "type": "footer",
                    "name": "Rodapé do Relatório",
                    "height": 40,
                    "visible": True,
                    "background_color": "",
                    "elements": []
                },
                {
                    "id": "page_footer",
                    "type": "page_footer",
                    "name": "Rodapé de Página",
                    "height": 60,
                    "visible": True,
                    "print_on_last_page": True,
                    "background_color": "",
                    "elements": []
                }
            ],
            "variables": [],
            "expressions": []
        }
    
    def save(self, *args, **kwargs):
        """Override save para garantir estrutura padrão"""
        if not self.layout_json:
            self.layout_json = self._get_default_structure()
        
        # Se for marcado como padrão, desmarcar outros
        if self.padrao:
            LayoutReport.objects.filter(
                usuario=self.usuario,
                padrao=True
            ).exclude(pk=self.pk).update(padrao=False)
        
        super().save(*args, **kwargs)


class ReportHistory(models.Model):
    """Histórico de geração de relatórios"""
    layout = models.ForeignKey(LayoutReport, on_delete=models.CASCADE, related_name='historico')
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    rota = models.ForeignKey(Rota, on_delete=models.SET_NULL, null=True, blank=True)
    data_geracao = models.DateTimeField(auto_now_add=True)
    
    # Estatísticas
    total_registros = models.IntegerField(default=0)
    total_paginas = models.IntegerField(default=0)
    tempo_geracao = models.FloatField(null=True, blank=True, help_text='Tempo em segundos')
    
    # Arquivo gerado
    arquivo = models.FileField(upload_to='reports/%Y/%m/', null=True, blank=True)
    formato = models.CharField(max_length=10, default='pdf', choices=[
        ('pdf', 'PDF'),
        ('excel', 'Excel'),
        ('csv', 'CSV'),
    ])
    
    class Meta:
        verbose_name = 'Histórico de Relatório'
        verbose_name_plural = 'Históricos de Relatórios'
        ordering = ['-data_geracao']
    
    def __str__(self):
        return f"{self.layout.nome} - {self.data_geracao.strftime('%d/%m/%Y %H:%M')}"


class SqlExtra(models.Model):
    """SQL auxiliar para finalidades como listar produtos por pedido, relatórios customizados, etc."""

    TIPO_CHOICES = [
        ('produtos', 'Produtos por Pedido'),
        ('personalizado', 'Personalizado'),
    ]

    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sqls_extra')
    conexao = models.ForeignKey(ConexaoFirebird, on_delete=models.CASCADE, related_name='sqls_extra', verbose_name='Conexão Firebird')
    nome = models.CharField(max_length=255, verbose_name='Nome')
    descricao = models.TextField(blank=True, null=True, verbose_name='Descrição')
    tipo = models.CharField(max_length=50, choices=TIPO_CHOICES, default='personalizado', verbose_name='Tipo')
    sql = models.TextField(verbose_name='SQL')
    campo_join_pedido = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name='Campo de Ligação (Pedido)',
        help_text='(Deprecated) Use campos_join. Nome da coluna que contém o nº do pedido.',
    )
    campos_join = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Campos de Ligação',
        help_text='Lista de pares [{"coluna_sql": "...", "campo_pedido": "..."}] para vincular ao pedido.',
    )
    ativo = models.BooleanField(default=True, verbose_name='Ativo')
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_modificacao = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'SQL Extra'
        verbose_name_plural = 'SQLs Extra'
        ordering = ['tipo', 'nome']

    def __str__(self):
        return f"{self.nome} ({self.get_tipo_display()})"


class RaioXAba(models.Model):
    """Aba configurável do modal Raio X do Cliente."""

    TIPO_CHOICES = [
        ('dados_pedido', 'Dados do Pedido'),
        ('sql', 'Consulta SQL'),
        ('texto', 'Texto Livre'),
    ]

    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='raio_x_abas')
    nome = models.CharField(max_length=100, verbose_name='Nome da Aba')
    ordem = models.PositiveIntegerField(default=0, verbose_name='Ordem')
    tipo = models.CharField(max_length=20, choices=TIPO_CHOICES, default='sql', verbose_name='Tipo')
    sql_extra = models.ForeignKey(
        'SqlExtra', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='raio_x_abas', verbose_name='SQL Extra',
    )
    campos_join = models.JSONField(default=list, blank=True, verbose_name='Parâmetros de Ligação')
    kpis_config = models.JSONField(default=list, blank=True, verbose_name='Configuração de KPIs')
    colunas_visiveis = models.JSONField(default=list, blank=True, verbose_name='Colunas Visíveis')
    grafico_config = models.JSONField(default=dict, blank=True, verbose_name='Configuração de Gráfico')
    pivot_config = models.JSONField(default=dict, blank=True, verbose_name='Configuração de Pivot')
    widget_configs = models.JSONField(default=dict, blank=True, verbose_name='Widgets de Campo')
    sqls_extras = models.JSONField(default=list, blank=True, verbose_name='SQLs Adicionais')
    detail_config = models.JSONField(default=dict, blank=True, verbose_name='Configuração de Painel de Detalhe')
    componentes_ordem = models.JSONField(default=list, blank=True, verbose_name='Ordem dos Componentes')
    layout_config = models.JSONField(default=dict, blank=True, verbose_name='Layout do Dashboard')
    texto = models.TextField(blank=True, verbose_name='Texto Livre')
    ativo = models.BooleanField(default=True)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_modificacao = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Aba do Raio X'
        verbose_name_plural = 'Abas do Raio X'
        ordering = ['ordem', 'id']

    def __str__(self):
        return f"{self.nome} ({self.usuario.username})"


class ConfiguracaoGlobal(models.Model):
    """Configuração global do sistema — singleton (pk=1)."""
    campos_busca_endereco = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Campos para Busca de Endereço',
        help_text='Lista ordenada de campos do SQL usados para compor o texto de busca do endereço.',
    )
    regras_arquivamento_pedidos = models.JSONField(
        default=list,
        blank=True,
        verbose_name='Regras de Arquivamento Automático de Pedidos',
    )
    intervalo_arquivamento_horas = models.PositiveIntegerField(
        default=24,
        verbose_name='Intervalo de Arquivamento (horas)',
        help_text='De quantas em quantas horas o arquivamento automático será executado.',
    )
    ultima_execucao_arquivamento = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Última Execução do Arquivamento',
    )
    intervalo_quarentena_horas = models.PositiveIntegerField(
        default=24,
        verbose_name='Intervalo de Quarentena (horas)',
        help_text='De quantas em quantas horas a exclusão por quarentena será verificada.',
    )
    ultima_execucao_quarentena = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Última Execução da Quarentena',
    )

    class Meta:
        verbose_name = 'Configuração Global'
        verbose_name_plural = 'Configurações Globais'

    def __str__(self):
        return 'Configuração Global'

    @classmethod
    def get_instance(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class HistoricoExclusaoPedido(models.Model):
    """Registro histórico de pedidos excluídos pela quarentena automática. Autocontido — sem FKs."""
    numero_pedido = models.CharField(max_length=100, verbose_name='Número do Pedido')
    cliente_nome = models.CharField(max_length=255, verbose_name='Nome do Cliente')
    entregador = models.CharField(max_length=255, blank=True, null=True, verbose_name='Entregador')
    endereco = models.CharField(max_length=500, blank=True, null=True, verbose_name='Endereço')
    dados_json = models.JSONField(default=dict, blank=True, verbose_name='Dados Completos')
    data_importacao = models.DateTimeField(null=True, blank=True, verbose_name='Data de Importação')
    data_arquivamento = models.DateTimeField(null=True, blank=True, verbose_name='Data de Arquivamento')
    dias_quarentena = models.PositiveIntegerField(null=True, blank=True, verbose_name='Dias de Quarentena')
    data_exclusao = models.DateTimeField(auto_now_add=True, verbose_name='Data de Exclusão')
    regra_aplicada = models.JSONField(default=dict, blank=True, verbose_name='Regra Aplicada')

    class Meta:
        verbose_name = 'Histórico de Exclusão de Pedido'
        verbose_name_plural = 'Histórico de Exclusões de Pedidos'
        ordering = ['-data_exclusao']

    def __str__(self):
        return f"Excluído: {self.numero_pedido} — {self.data_exclusao.strftime('%d/%m/%Y')}"
