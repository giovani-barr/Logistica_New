"""
Modelos para o Editor de Layout de Relatórios (Similar ao FastReport)
"""
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator
import json


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
        'QueryFirebird',
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


class ReportElement(models.Model):
    """
    Modelo auxiliar para documentar tipos de elementos
    (não usado diretamente no banco, apenas para referência)
    """
    
    ELEMENT_TYPES = [
        ('text', 'Texto Estático'),
        ('field', 'Campo de Dados'),
        ('label', 'Rótulo'),
        ('line', 'Linha'),
        ('rectangle', 'Retângulo'),
        ('image', 'Imagem'),
        ('barcode', 'Código de Barras'),
        ('qrcode', 'QR Code'),
        ('expression', 'Expressão/Fórmula'),
        ('aggregate', 'Agregação (SUM, COUNT, AVG, etc.)'),
    ]
    
    ALIGNMENT_CHOICES = [
        ('left', 'Esquerda'),
        ('center', 'Centro'),
        ('right', 'Direita'),
        ('justify', 'Justificado'),
    ]
    
    VERTICAL_ALIGNMENT_CHOICES = [
        ('top', 'Superior'),
        ('middle', 'Meio'),
        ('bottom', 'Inferior'),
    ]
    
    class Meta:
        managed = False  # Não criar tabela no banco
        

"""
Estrutura JSON de um elemento:
{
    "id": "elemento_1",
    "type": "field",  # text, field, label, line, rectangle, image, etc.
    "name": "Cliente",
    "x": 10,  # posição X em mm
    "y": 5,   # posição Y em mm
    "width": 80,  # largura em mm
    "height": 10, # altura em mm
    "z_index": 1, # ordem de camadas
    
    # Para elementos de texto/campo
    "data_field": "cliente_nome",  # campo da query
    "text": "Texto estático",  # para tipo 'text'
    "expression": "[cliente_nome] + ' - ' + [cidade]",  # expressão
    
    # Formatação
    "font_family": "Helvetica",
    "font_size": 10,
    "font_bold": false,
    "font_italic": false,
    "font_underline": false,
    "color": "#000000",
    "background_color": "",
    "border_width": 0,
    "border_color": "#000000",
    "border_style": "solid",  # solid, dashed, dotted
    "border_sides": ["top", "right", "bottom", "left"],
    
    # Alinhamento
    "alignment": "left",  # left, center, right, justify
    "vertical_alignment": "top",  # top, middle, bottom
    "padding": 2,  # padding interno em mm
    
    # Visibilidade e condições
    "visible": true,
    "visibility_expression": "",  # expressão para mostrar/ocultar
    "format": "",  # formato de número/data (ex: "0.00", "dd/MM/yyyy")
    
    # Para agregações
    "aggregate_function": "",  # SUM, COUNT, AVG, MIN, MAX
    "aggregate_field": "",
    "aggregate_scope": "all",  # all, group, page
    
    # Para linhas
    "line_width": 1,
    "line_style": "solid",
    
    # Para imagens
    "image_source": "",  # URL ou base64
    "image_fit": "contain",  # contain, cover, fill
    
    # Para código de barras/QR
    "barcode_type": "code128",
    "barcode_data_field": ""
}
"""


class ReportHistory(models.Model):
    """Histórico de geração de relatórios"""
    layout = models.ForeignKey(LayoutReport, on_delete=models.CASCADE, related_name='historico')
    usuario = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    rota = models.ForeignKey('Rota', on_delete=models.SET_NULL, null=True, blank=True)
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
