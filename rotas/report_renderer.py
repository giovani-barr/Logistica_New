"""
Motor de Renderização de Relatórios com ReportLab
Converte o layout JSON do editor visual em PDF real
"""
import io
import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, A3, A5, letter, legal, landscape
from reportlab.lib.units import mm, cm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Frame, PageTemplate, BaseDocTemplate, KeepTogether
)
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.graphics.shapes import Drawing, Line, Rect
from reportlab.graphics import renderPDF


# Mapeamento de tamanhos de página
PAGE_SIZES = {
    'A4': A4,
    'A3': A3,
    'A5': A5,
    'Letter': letter,
    'Legal': legal,
}

# Mapeamento de alinhamentos
ALIGNMENTS = {
    'left': TA_LEFT,
    'center': TA_CENTER,
    'right': TA_RIGHT,
    'justify': TA_JUSTIFY,
}

# Fontes disponíveis no ReportLab
FONT_MAP = {
    'Helvetica': 'Helvetica',
    'Arial': 'Helvetica',
    'Times New Roman': 'Times-Roman',
    'Times': 'Times-Roman',
    'Courier': 'Courier',
    'Courier New': 'Courier',
}


def hex_to_color(hex_str):
    """Converte cor hexadecimal para objeto Color do ReportLab"""
    if not hex_str or hex_str == 'transparent' or hex_str == '':
        return None
    hex_str = hex_str.lstrip('#')
    if len(hex_str) == 6:
        r = int(hex_str[0:2], 16) / 255.0
        g = int(hex_str[2:4], 16) / 255.0
        b = int(hex_str[4:6], 16) / 255.0
        return colors.Color(r, g, b)
    return None


def get_font_name(family, bold=False, italic=False):
    """Retorna o nome da fonte ReportLab com variações bold/italic"""
    base = FONT_MAP.get(family, 'Helvetica')
    
    if base == 'Helvetica':
        if bold and italic:
            return 'Helvetica-BoldOblique'
        elif bold:
            return 'Helvetica-Bold'
        elif italic:
            return 'Helvetica-Oblique'
        return 'Helvetica'
    elif base == 'Times-Roman':
        if bold and italic:
            return 'Times-BoldItalic'
        elif bold:
            return 'Times-Bold'
        elif italic:
            return 'Times-Italic'
        return 'Times-Roman'
    elif base == 'Courier':
        if bold and italic:
            return 'Courier-BoldOblique'
        elif bold:
            return 'Courier-Bold'
        elif italic:
            return 'Courier-Oblique'
        return 'Courier'
    
    return base


class ReportRenderer:
    """
    Motor de renderização que converte layout JSON do editor visual em PDF.
    
    Fluxo:
    1. Recebe layout_json (do editor) + dados (lista de registros)
    2. Interpreta as bandas (page_header, header, detail, footer, page_footer)
    3. Renderiza cada elemento nas posições definidas
    4. Gera PDF usando ReportLab Canvas API
    """
    
    def __init__(self, layout, dados=None):
        """
        Args:
            layout: instância de LayoutReport ou dict com configurações
            dados: lista de dicts com os dados dos registros
        """
        if hasattr(layout, 'layout_json'):
            # É uma instância de LayoutReport
            self.layout_json = layout.get_layout_structure()
            self.page_size_name = layout.page_size
            self.orientation = layout.orientation
            self.margin_top = layout.margin_top
            self.margin_bottom = layout.margin_bottom
            self.margin_left = layout.margin_left
            self.margin_right = layout.margin_right
            self.default_font = layout.default_font_family
            self.default_font_size = layout.default_font_size
        else:
            # É um dict direto
            self.layout_json = layout.get('layout_json', {})
            self.page_size_name = layout.get('page_size', 'A4')
            self.orientation = layout.get('orientation', 'portrait')
            self.margin_top = float(layout.get('margin_top', 20))
            self.margin_bottom = float(layout.get('margin_bottom', 20))
            self.margin_left = float(layout.get('margin_left', 15))
            self.margin_right = float(layout.get('margin_right', 15))
            self.default_font = layout.get('default_font_family', 'Helvetica')
            self.default_font_size = int(layout.get('default_font_size', 10))
        
        self.dados = dados or []
        self.bands = {}
        self.page_num = 0
        self.total_pages = 0
        self.record_num = 0
        self.current_record = {}
        
        # Parsing das bandas
        self._parse_bands()
        
        # Configuração da página
        base_size = PAGE_SIZES.get(self.page_size_name, A4)
        if self.orientation == 'landscape':
            self.page_width, self.page_height = base_size[1], base_size[0]
        else:
            self.page_width, self.page_height = base_size
        
        # Área útil (descontando margens)
        self.usable_width = self.page_width - (self.margin_left * mm) - (self.margin_right * mm)
        self.usable_x = self.margin_left * mm
        
        # Fator de escala: o editor usa pixels (96 DPI), ReportLab usa pontos (72 DPI)
        # 1 pixel do editor ≈ 0.75 pontos no PDF
        self.scale_factor = 72.0 / 96.0
    
    def _parse_bands(self):
        """Organiza as bandas por tipo para fácil acesso"""
        bands_list = self.layout_json.get('bands', [])
        for band in bands_list:
            band_type = band.get('type', band.get('id', ''))
            self.bands[band_type] = band
    
    def _get_band(self, band_type):
        """Retorna uma banda pelo tipo, ou None se não existir/invisível"""
        band = self.bands.get(band_type)
        if band and band.get('visible', True):
            return band
        return None
    
    def _scale(self, px):
        """Converte pixels do editor para pontos do PDF"""
        return px * self.scale_factor
    
    def _eval_expression(self, expression, record=None):
        """Avalia expressões simples no contexto do relatório"""
        if not expression:
            return ''
        
        # Variáveis de sistema
        now = datetime.now()
        replacements = {
            '{PageNumber}': str(self.page_num),
            '{TotalPages}': str(self.total_pages),
            '{Date}': now.strftime('%d/%m/%Y'),
            '{Time}': now.strftime('%H:%M:%S'),
            '{DateTime}': now.strftime('%d/%m/%Y %H:%M'),
            '{RecordNumber}': str(self.record_num),
            '{TotalRecords}': str(len(self.dados)),
        }
        
        result = expression
        
        # Substituir variáveis de sistema
        for key, val in replacements.items():
            result = result.replace(key, val)
        
        # Substituir campos do registro atual se disponível
        if record:
            # Procurar por padrões [campo] na expressão
            import re
            field_pattern = r'\[([^\]]+)\]'
            fields_in_expression = re.findall(field_pattern, result)
            
            for field_name in fields_in_expression:
                field_value = record.get(field_name, f'[{field_name}]')
                result = result.replace(f'[{field_name}]', str(field_value))
        
        return result
    
    def _get_element_value(self, element, record=None):
        """Resolve o valor de um elemento baseado no seu tipo"""
        elem_type = element.get('type', 'text')
        field_name = element.get('data_field', '')
        
        print(f"DEBUG ELEMENT: type={elem_type}, field='{field_name}', element_id={element.get('id', 'no-id')}")
        if record:
            print(f"DEBUG RECORD: Available fields = {list(record.keys())}")
            if field_name:
                print(f"DEBUG FIELD LOOKUP: '{field_name}' = {record.get(field_name)} (exists: {field_name in record})")
        else:
            print("DEBUG: No record provided")
        
        if elem_type == 'text':
            result = element.get('text', '')
            print(f"DEBUG TEXT: '{result}'")
            return result
        
        elif elem_type == 'field':
            if record and field_name:
                # Usar nova função de busca melhorada
                value = self._find_field_value(record, field_name)
                
                # Se o valor existe e não está vazio, retorna ele
                if value is not None:
                    str_value = str(value).strip()
                    if str_value and str_value.lower() not in ['null', 'none', '']:
                        print(f"DEBUG FIELD SUCCESS: '{field_name}' = '{str_value}'")
                        return str_value
                
                # Se não encontrou o campo ou está vazio, mostrar placeholder
                print(f"DEBUG FIELD FAILED: '{field_name}' not found or empty")
                return f'[{field_name}]'
            print(f"DEBUG FIELD NO DATA: field='{field_name}', has_record={record is not None}")
            return f'[{field_name}]' if field_name else '[Campo]'
        
        elif elem_type == 'expression':
            expr = element.get('expression', '')
            result = self._eval_expression(expr, record)
            print(f"DEBUG EXPRESSION: '{expr}' = '{result}'")
            return result
        
        elif elem_type == 'aggregate':
            result = self._calc_aggregate(element)
            print(f"DEBUG AGGREGATE RESULT: {result}")
            return result
        
        default_result = element.get('text', element.get('name', ''))
        print(f"DEBUG DEFAULT: '{default_result}'")
        return default_result
    
    def _find_field_value(self, record, field_name):
        """Busca um campo no record usando diferentes estratégias"""
        if not record or not field_name:
            return None
            
        # 0. Busca exata primeiro
        if field_name in record:
            val = record[field_name]
            print(f"DEBUG FIND: Encontrado exato '{field_name}' = {val}")
            return val
        
        # 1. Busca case-insensitive
        field_lower = field_name.lower().strip()
        for key, value in record.items():
            if str(key).lower().strip() == field_lower:
                print(f"DEBUG FIND: Encontrado case-insensitive '{field_name}' -> '{key}' = {value}")
                return value
        
        # 2. Busca removendo caracteres especiais e espaços
        field_normalized = ''.join(c for c in field_name.lower() if c.isalnum())
        for key, value in record.items():
            key_normalized = ''.join(c for c in str(key).lower() if c.isalnum())
            if field_normalized == key_normalized:
                print(f"DEBUG FIND: Encontrado normalizado '{field_name}' -> '{key}' = {value}")
                return value
        
        # 3. Busca por palavras-chave (para campos compostos)
        field_words = set(field_lower.replace('_', ' ').split())
        best_match = None
        best_score = 0
        best_key = None
        
        for key, value in record.items():
            if value is None or str(value).strip() == '':
                continue
                
            key_lower = str(key).lower().replace('_', ' ')
            key_words = set(key_lower.split())
            
            # Contar quantas palavras coincidem
            score = len(field_words & key_words)
            
            if score > best_score and score > 0:
                best_match = value
                best_score = score
                best_key = key
        
        if best_match is not None and best_score > 0:
            print(f"DEBUG FIND: Encontrado parcial '{field_name}' -> '{best_key}' (score: {best_score}) = {best_match}")
            return best_match
        
        # 4. Mapeamentos específicos conhecidos (expandido)
        field_mappings = {
            'pedido': ['Pedido', 'numero_pedido', 'numero pedido', 'pedido_num', 'order_number', 'numero'],
            'numero pedido': ['Pedido', 'numero_pedido', 'numero pedido', 'order_number', 'numero'],
            'cliente': ['Cliente', 'cliente nome', 'cliente_nome', 'nome_cliente', 'client_name'],
            'cliente nome': ['Cliente', 'cliente_nome', 'nome_cliente', 'client_name'],
            'endereco': ['Endereco', 'endereco_cliente', 'endereco cliente', 'address'],
            'endereco cliente': ['Endereco', 'endereco_cliente', 'endereco cliente', 'address'],
            'bairro': ['Bairro', 'bairro_cliente', 'bairro cliente', 'district'],
            'bairro cliente': ['Bairro', 'bairro_cliente', 'bairro cliente', 'district'],
            'cidade': ['Cidade', 'cidade_cliente', 'cidade cliente', 'city'],
            'cidade cliente': ['Cidade', 'cidade_cliente', 'cidade cliente', 'city'],
            'cep': ['CEP', 'cep_cliente', 'cep cliente', 'postal_code'],
            'telefone': ['Telefone', 'telefone_cliente', 'telefone cliente', 'phone', 'fone'],
            'email': ['Email', 'email_cliente', 'email cliente', 'email_address'],
            'observacoes': ['Observacoes', 'observacao', 'obs', 'observacao_cliente', 'notes', 'comments'],
            'valor': ['Valor', 'valor_pedido', 'valor pedido', 'total', 'amount', 'price'],
            'valor pedido': ['Valor', 'valor_pedido', 'valor pedido', 'total', 'amount'],
            'quantidade': ['Quantidade', 'qty', 'quantity'],
            'tipo': ['Tipo', 'tipo_parada', 'tipo_entrega', 'type'],
            'data': ['Data', 'data_pedido', 'order_date', 'date'],
            'data pedido': ['Data', 'data_pedido', 'order_date'],
            'nome vendedor': ['Nome vendedor', 'nome_vendedor', 'vendedor', 'seller_name'],
            'vendedor': ['Vendedor', 'nome_vendedor', 'seller_name'],
        }
        
        # Tentar mapeamentos diretos
        for mapped_field in field_mappings.get(field_lower, []):
            if mapped_field in record:
                val = record[mapped_field]
                print(f"DEBUG FIND: Encontrado mapeamento '{field_name}' -> '{mapped_field}' = {val}")
                return val
            
            # Tentar case-insensitive para cada mapeamento
            mapped_lower = mapped_field.lower().strip()
            for key, value in record.items():
                if str(key).lower().strip() == mapped_lower:
                    print(f"DEBUG FIND: Encontrado mapeamento C.I '{field_name}' -> '{key}' = {value}")
                    return value
        
        print(f"DEBUG FIND: Campo NÃO ENCONTRADO '{field_name}' em {list(record.keys())[:5]}...")
        return None

    def _calc_aggregate(self, element):
        """Calcula valor agregado (soma, contagem, média, etc.)"""
        # Corrigir nomes dos campos para compatibilidade com o JavaScript
        agg_type = (
            element.get('aggregate_function')
            or element.get('aggregateFunction')
            or 'SUM'
        )
        agg_type = str(agg_type).strip().upper()
        field_name = (
            element.get('aggregate_field')
            or element.get('aggregateField')
            or element.get('data_field')
            or ''
        )
        field_name = str(field_name).strip()
        
        print(f"DEBUG AGGREGATE: type={agg_type}, field={field_name}, element_id={element.get('id')}")
        
        if not self.dados:
            print("DEBUG: Nenhum dado disponível para agregação")
            return '0'
        
        if agg_type == 'COUNT':
            result = str(len(self.dados))
            print(f"DEBUG COUNT: {result} registros")
            return result
        
        if not field_name:
            print(f"DEBUG: Campo não especificado para {agg_type}")
            return '0'
        
        values = []
        for i, record in enumerate(self.dados):
            # Usar função de busca melhorada
            val = self._find_field_value(record, field_name)
            
            if val is not None:
                try:
                    # Limpar e converter valor numérico
                    str_val = str(val).strip()
                    clean_val = str_val.replace(',', '.').replace('R$', '').replace('R$ ', '').strip()
                    
                    # Ignorar valores vazios ou não-numéricos
                    if clean_val and clean_val != '0':
                        numeric_val = float(clean_val)
                        values.append(numeric_val)
                        print(f"DEBUG AGGREGATE: Record {i}: '{field_name}' = {str_val} -> {numeric_val}")
                except (ValueError, TypeError) as e:
                    print(f"DEBUG AGGREGATE: Record {i}: Não conversível '{val}': {e}")
                    pass
        
        print(f"DEBUG AGGREGATE: {agg_type}({field_name}) coletou {len(values)} valores: {values}")
        
        if not values:
            print(f"DEBUG AGGREGATE: Nenhum valor numérico encontrado para {field_name}")
            return '0'
        
        try:
            if agg_type == 'SUM':
                result = sum(values)
                formatted = f'{result:,.2f}'.replace(',', '.')
                print(f"DEBUG SUM: {values} = {result} -> {formatted}")
                return formatted
            elif agg_type == 'AVG':
                result = sum(values) / len(values)
                formatted = f'{result:,.2f}'.replace(',', '.')
                print(f"DEBUG AVG: {formatted}")
                return formatted
            elif agg_type == 'MIN':
                result = min(values)
                formatted = f'{result:,.2f}'.replace(',', '.')
                print(f"DEBUG MIN: {formatted}")
                return formatted
            elif agg_type == 'MAX':
                result = max(values)
                formatted = f'{result:,.2f}'.replace(',', '.')
                print(f"DEBUG MAX: {formatted}")
                return formatted
            elif agg_type == 'COUNT':
                return str(len(values))
        except Exception as e:
            print(f"DEBUG AGGREGATE ERROR: {e}")
            return '0'
        
        return str(len(values))
    
    def _draw_element(self, c, element, band_x, band_y, record=None):
        """
        Desenha um elemento individual no canvas PDF.
        
        Args:
            c: Canvas do ReportLab
            element: Dict do elemento
            band_x: Posição X da banda
            band_y: Posição Y do topo da banda (coordenada ReportLab, origem bottom-left)
            record: Dict com dados do registro atual (para campos de dados)
        """
        elem_type = element.get('type', 'text')
        
        # Posição e tamanho (converter pixels do editor para pontos)
        x = band_x + self._scale(element.get('x', 0))
        elem_y_in_band = self._scale(element.get('y', 0))
        width = self._scale(element.get('width', 100))
        height = self._scale(element.get('height', 20))
        
        # band_y é o topo da parte de conteúdo da banda (já descontado o header)
        # No ReportLab, Y cresce de baixo para cima
        y = band_y - elem_y_in_band - height
        
        # Background
        bg_color = hex_to_color(element.get('background_color', ''))
        if bg_color:
            c.setFillColor(bg_color)
            c.rect(x, y, width, height, fill=1, stroke=0)
        
        # Bordas
        border_width = element.get('border_width', 0)
        if border_width and border_width > 0:
            border_color = hex_to_color(element.get('border_color', '#000000')) or colors.black
            border_sides = element.get('border_sides', ['top', 'right', 'bottom', 'left'])
            c.setStrokeColor(border_color)
            c.setLineWidth(border_width * self.scale_factor)
            
            if 'top' in border_sides:
                c.line(x, y + height, x + width, y + height)
            if 'bottom' in border_sides:
                c.line(x, y, x + width, y)
            if 'left' in border_sides:
                c.line(x, y, x, y + height)
            if 'right' in border_sides:
                c.line(x + width, y, x + width, y + height)
        
        # Tipo: Linha
        if elem_type == 'line':
            line_color = hex_to_color(element.get('color', '#000000')) or colors.black
            c.setStrokeColor(line_color)
            c.setLineWidth(max(1, border_width * self.scale_factor))
            c.line(x, y + height / 2, x + width, y + height / 2)
            return
        
        # Tipo: Retângulo
        if elem_type == 'rectangle':
            rect_color = hex_to_color(element.get('color', '#000000')) or colors.black
            c.setStrokeColor(rect_color)
            c.setLineWidth(max(1, border_width * self.scale_factor) if border_width else 1)
            fill = 1 if bg_color else 0
            c.rect(x, y, width, height, fill=fill, stroke=1)
            return
        
        # Tipo: Imagem
        if elem_type == 'image':
            image_path = element.get('image_path', '')
            if image_path and os.path.exists(image_path):
                try:
                    c.drawImage(image_path, x, y, width, height, preserveAspectRatio=True)
                except Exception:
                    pass
            return
        
        # Tipos com texto (text, field, expression, aggregate)
        value = self._get_element_value(element, record)
        if not value:
            return
        
        # Fonte
        font_family = element.get('font_family', self.default_font)
        font_size = element.get('font_size', self.default_font_size) or self.default_font_size
        font_bold = element.get('font_bold', False)
        font_italic = element.get('font_italic', False)
        font_underline = element.get('font_underline', False)
        text_color = hex_to_color(element.get('color', '#000000')) or colors.black
        alignment = element.get('alignment', 'left')
        
        font_name = get_font_name(font_family, font_bold, font_italic)
        font_size_pt = font_size * self.scale_factor
        
        # Padding
        padding = element.get('padding', 2) * self.scale_factor
        
        c.setFont(font_name, font_size_pt)
        c.setFillColor(text_color)
        
        # Posição do texto dentro do elemento
        text_x = x + padding
        text_width = width - (padding * 2)
        
        # Alinhamento vertical
        v_align = element.get('vertical_alignment', 'top')
        if v_align == 'middle':
            text_y = y + (height / 2) - (font_size_pt / 3)
        elif v_align == 'bottom':
            text_y = y + padding
        else:  # top
            text_y = y + height - font_size_pt - padding
        
        # Desenhar texto com alinhamento horizontal
        if alignment == 'center':
            text_x = x + (width / 2)
            c.drawCentredString(text_x, text_y, str(value))
        elif alignment == 'right':
            text_x = x + width - padding
            c.drawRightString(text_x, text_y, str(value))
        else:
            # Truncar texto que excede a largura
            while c.stringWidth(str(value), font_name, font_size_pt) > text_width and len(str(value)) > 1:
                value = str(value)[:-1]
            c.drawString(text_x, text_y, str(value))
        
        # Sublinhado
        if font_underline:
            c.setStrokeColor(text_color)
            c.setLineWidth(0.5)
            underline_y = text_y - 1
            if alignment == 'center':
                tw = c.stringWidth(str(value), font_name, font_size_pt)
                c.line(text_x - tw / 2, underline_y, text_x + tw / 2, underline_y)
            elif alignment == 'right':
                tw = c.stringWidth(str(value), font_name, font_size_pt)
                c.line(text_x - tw, underline_y, text_x, underline_y)
            else:
                tw = c.stringWidth(str(value), font_name, font_size_pt)
                c.line(text_x, underline_y, text_x + tw, underline_y)
    
    def _draw_band(self, c, band, y_position, record=None):
        """
        Desenha uma banda inteira com todos seus elementos.
        
        Args:
            c: Canvas do ReportLab
            band: Dict da banda
            y_position: Posição Y do topo da banda (coordenada ReportLab)
            record: Dados do registro (para banda detail)
            
        Returns:
            Altura ocupada pela banda em pontos
        """
        if not band or not band.get('visible', True):
            return 0
        
        # No editor visual, band.height inclui o cabeçalho da banda (~28px).
        # No PDF esse cabeçalho não existe, então descontamos para evitar espaço em branco extra.
        BAND_HEADER_PX = 28  # height: calc(100% - 28px) no CSS do editor
        content_height_px = max(10, band.get('height', 30) - BAND_HEADER_PX)
        band_height = self._scale(content_height_px)
        band_x = self.usable_x
        
        # Background da banda
        bg_color = hex_to_color(band.get('background_color', ''))
        if bg_color:
            c.setFillColor(bg_color)
            c.rect(band_x, y_position - band_height, self.usable_width, band_height, fill=1, stroke=0)
        
        # Desenhar elementos da banda
        elements = band.get('elements', [])
        for element in elements:
            self._draw_element(c, element, band_x, y_position, record)
        
        return band_height
    
    def render(self):
        """
        Renderiza o relatório completo e retorna bytes do PDF.
        
        Returns:
            bytes: Conteúdo do PDF
        """
        import logging
        logger = logging.getLogger(__name__)
        
        buffer = io.BytesIO()
        
        c = pdfcanvas.Canvas(buffer, pagesize=(self.page_width, self.page_height))
        c.setTitle('Relatório')
        c.setAuthor('Sistema de Logística')
        
        # Log para debug
        logger.info(f"Gerando relatório com {len(self.dados)} registros")
        if self.dados:
            logger.info(f"Campos disponíveis no primeiro registro: {list(self.dados[0].keys())}")
        
        # Calcular total de páginas (estimativa)
        self._estimate_pages()
        
        if not self.dados:
            # Relatório sem dados - gerar preview com placeholders
            logger.warning("Relatório sendo gerado sem dados - usando placeholders")
            self._render_page(c, [])
        else:
            # Renderizar com dados reais
            logger.info(f"Renderizando relatório com dados reais - {len(self.dados)} registros")
            self._render_with_data(c)
        
        c.save()
        buffer.seek(0)
        return buffer.getvalue()
    
    def _estimate_pages(self):
        """Estima o total de páginas"""
        page_header = self._get_band('page_header')
        header = self._get_band('header')
        detail = self._get_band('detail')
        footer = self._get_band('footer')
        page_footer = self._get_band('page_footer')
        
        # Alturas das bandas fixas
        fixed_height = 0
        if page_header:
            fixed_height += self._scale(page_header.get('height', 0))
        if page_footer:
            fixed_height += self._scale(page_footer.get('height', 0))
        
        # Altura disponível para content
        available_height = self.page_height - (self.margin_top * mm) - (self.margin_bottom * mm) - fixed_height
        
        # Altura do header (só na primeira página)
        header_height = self._scale(header.get('height', 0)) if header else 0
        
        # Altura do footer do relatório
        footer_height = self._scale(footer.get('height', 0)) if footer else 0
        
        # Altura por registro (descontando os 28px do cabeçalho visual da banda)
        BAND_HEADER_PX = 28
        detail_h_px = max(10, detail.get('height', 30) - BAND_HEADER_PX) if detail else 10
        detail_height = self._scale(detail_h_px) if detail else self._scale(10)
        
        if not self.dados or detail_height == 0:
            self.total_pages = 1
            return
        
        # Primeira página tem menos espaço (header + footer do relatório)
        first_page_available = available_height - header_height - footer_height
        records_first = max(1, int(first_page_available / detail_height))
        
        remaining = max(0, len(self.dados) - records_first)
        
        if remaining == 0:
            self.total_pages = 1
        else:
            other_page_available = available_height - footer_height
            records_per_page = max(1, int(other_page_available / detail_height))
            self.total_pages = 1 + max(1, -(-remaining // records_per_page))  # ceil division
    
    def _render_page(self, c, records, is_first_page=True, is_last_page=True):
        """Renderiza uma página individual"""
        self.page_num += 1
        y = self.page_height - (self.margin_top * mm)
        page_record = records[0] if records else None
        global_record = self.dados[0] if self.dados else None
        header_record = page_record or global_record
        
        # Page Header
        page_header = self._get_band('page_header')
        if page_header:
            if is_first_page or page_header.get('print_on_first_page', True):
                h = self._draw_band(c, page_header, y, header_record)
                y -= h
        
        # Header (apenas primeira página)
        if is_first_page:
            header = self._get_band('header')
            if header:
                h = self._draw_band(c, header, y, global_record or header_record)
                y -= h
        
        # Detail - renderizar cada registro
        detail = self._get_band('detail')
        if detail:
            alt_color = hex_to_color(detail.get('alternate_color', ''))
            use_alt = detail.get('alternating_color', False)
            
            for i, record in enumerate(records):
                self.record_num += 1
                self.current_record = record
                
                # Cor alternada
                if use_alt and alt_color and i % 2 == 1:
                    detail_copy = dict(detail)
                    detail_copy['background_color'] = detail.get('alternate_color', '')
                    h = self._draw_band(c, detail_copy, y, record)
                else:
                    h = self._draw_band(c, detail, y, record)
                y -= h
        
        # Footer (apenas última página)
        if is_last_page:
            footer = self._get_band('footer')
            if footer:
                # Posicionar o footer logo acima do page_footer
                page_footer = self._get_band('page_footer')
                pf_height = self._scale(page_footer.get('height', 0)) if page_footer else 0
                footer_height = self._scale(footer.get('height', 0))
                footer_y = (self.margin_bottom * mm) + pf_height + footer_height
                self._draw_band(c, footer, footer_y, global_record or header_record)
        
        # Page Footer
        page_footer = self._get_band('page_footer')
        if page_footer:
            if is_last_page or page_footer.get('print_on_last_page', True):
                pf_height = self._scale(page_footer.get('height', 0))
                pf_y = (self.margin_bottom * mm) + pf_height
                self._draw_band(c, page_footer, pf_y, header_record)
        
        c.showPage()
    
    def _render_with_data(self, c):
        """Renderiza o relatório com dados reais, paginando automaticamente"""
        page_header = self._get_band('page_header')
        header = self._get_band('header')
        detail = self._get_band('detail')
        footer = self._get_band('footer')
        page_footer = self._get_band('page_footer')
        
        # Calcular alturas fixas
        ph_height = self._scale(page_header.get('height', 0)) if page_header else 0
        pf_height = self._scale(page_footer.get('height', 0)) if page_footer else 0
        h_height = self._scale(header.get('height', 0)) if header else 0
        f_height = self._scale(footer.get('height', 0)) if footer else 0
        detail_height = self._scale(detail.get('height', 30)) if detail else 0
        
        # Dados para paginar
        all_records = list(self.dados)
        record_index = 0
        page_count = 0
        
        while record_index < len(all_records) or page_count == 0:
            page_count += 1
            is_first = (page_count == 1)
            
            # Calcular espaço disponível nesta página
            top_y = self.page_height - (self.margin_top * mm)
            bottom_y = (self.margin_bottom * mm) + pf_height + f_height
            
            available = top_y - bottom_y - ph_height
            if is_first:
                available -= h_height
            
            # Quantos registros cabem
            if detail_height > 0:
                records_fit = max(1, int(available / detail_height))
            else:
                records_fit = len(all_records)
            
            page_records = all_records[record_index:record_index + records_fit]
            record_index += len(page_records)
            
            is_last = (record_index >= len(all_records))
            
            self._render_page(c, page_records, is_first, is_last)
            
            if not all_records:
                break


def generate_pdf(layout, dados=None):
    """
    Função helper para gerar PDF a partir de um layout.
    
    Args:
        layout: instância de LayoutReport ou dict
        dados: lista de dicts com dados dos registros
        
    Returns:
        bytes: conteúdo do PDF
    """
    renderer = ReportRenderer(layout, dados)
    return renderer.render()


def get_full_firebird_data_for_rota(rota, limit=None):
    """
    Busca dados completos do Firebird baseado nos números dos pedidos da rota.
    Não depende de associações já existentes - vai direto no banco Firebird.
    
    Args:
        rota: instância de Rota
        limit: limite de registros (opcional)
        
    Returns:
        list: dados completos do Firebird para cada parada
    """
    from rotas.models import PedidoFirebird
    from django.db.models import Q
    
    print(f"DEBUG: Buscando dados completos do Firebird para rota {rota.id}")
    
    # Buscar todas as paradas da rota
    paradas = rota.paradas.all().order_by('sequencia')
    if limit:
        paradas = paradas[:limit]
    
    # Buscar todos os pedidos Firebird associados à rota
    pedidos_rota = list(PedidoFirebird.objects.filter(rota=rota))
    
    # Também buscar pedidos pelo usuário (em caso de não estar associado à rota ainda)
    if not pedidos_rota:
        pedidos_rota = list(PedidoFirebird.objects.filter(usuario=rota.usuario).order_by('-data_importacao')[:20])
    
    print(f"DEBUG: Encontrados {len(pedidos_rota)} pedidos para a rota")
    
    dados_completos = []
    pedidos_usados = set()
    
    for i, parada in enumerate(paradas):
        print(f"DEBUG: Processando parada {i+1}: {parada.cliente_nome}")
        
        # Dados básicos da parada (sempre incluir)
        dados_parada = {
            'Ordem': str(i + 1),
            'Sequencia': str(parada.sequencia),
            'Endereco': parada.endereco or '',
            'Cliente': parada.cliente_nome or '',
            'Cliente nome': parada.cliente_nome or '',  # Variação
            'Telefone': getattr(parada, 'cliente_telefone', '') or '',
            'Email': getattr(parada, 'cliente_email', '') or '',
            'Observacoes': parada.observacoes or '',
            'Bairro': parada.bairro or '',
            'Bairro cliente': parada.bairro or '',  # Variação
            'Cidade': parada.cidade or '',
            'Cidade cliente': parada.cidade or '',  # Variação
            'CEP': parada.cep or '',
            'Tipo': parada.get_tipo_display() or '',
            'Latitude': str(parada.latitude or ''),
            'Longitude': str(parada.longitude or ''),
            'Rota_Nome': rota.nome or '',
            'Rota_Data': rota.data_criacao.strftime('%d/%m/%Y') if rota.data_criacao else '',
            'Rota_Status': rota.get_status_display(),
            'Rota_Distancia': f"{rota.distancia_total or 0} km",
            'Rota_Tempo': f"{rota.tempo_total or 0} min",
            'Total_Paradas': str(paradas.count()),
            '_ordem': parada.sequencia,
            '_endereco': parada.endereco or ''
        }
        
        # Tentar encontrar pedido Firebird correspondente
        pedido_firebird = None
        
        # Estratégia 1: Por nome do cliente (case-insensitive)
        nome_cliente_lower = parada.cliente_nome.lower().strip() if parada.cliente_nome else ''
        if nome_cliente_lower and pedidos_rota:
            for pedido in pedidos_rota:
                if pedido.id not in pedidos_usados:  # Evitar usar o mesmo pedido 2 vezes
                    if pedido.cliente_nome and pedido.cliente_nome.lower().strip() == nome_cliente_lower:
                        pedido_firebird = pedido
                        pedidos_usados.add(pedido.id)
                        print(f"DEBUG: Pedido encontrado por cliente: {pedido.numero_pedido}")
                        break
        
        # Estratégia 2: Por índice (ordem de seqência)
        if not pedido_firebird and i < len(pedidos_rota):
            pedido = pedidos_rota[i]
            if pedido.id not in pedidos_usados:
                pedido_firebird = pedido
                pedidos_usados.add(pedido.id)
                print(f"DEBUG: Pedido encontrado por índice: {pedido.numero_pedido}")
        
        # Estratégia 3: Usar próximo pedido disponível
        if not pedido_firebird:
            for pedido in pedidos_rota:
                if pedido.id not in pedidos_usados:
                    pedido_firebird = pedido
                    pedidos_usados.add(pedido.id)
                    print(f"DEBUG: Pedido encontrado (próximo disponível): {pedido.numero_pedido}")
                    break
        
        # Se encontrou dados no Firebird, mesclar
        if pedido_firebird:
            print(f"DEBUG: Mesclando dados do Firebird para parada {i+1}")
            
            if pedido_firebird.dados_json:
                print(f"DEBUG: Campos do Firebird: {list(pedido_firebird.dados_json.keys())[:10]}...")
                
                # Começar com dados completos do Firebird
                dados_finais = pedido_firebird.dados_json.copy()
                
                # Adicionar informações do pedido
                dados_finais.update({
                    'numero_pedido': pedido_firebird.numero_pedido,
                    'Numero pedido': pedido_firebird.numero_pedido,
                    'Pedido': pedido_firebird.numero_pedido,
                })
                
                # Sobrescrever com dados específicos da parada/rota (prioridade para location)
                dados_parada_importante = {
                    'Endereco': parada.endereco,
                    'Bairro': parada.bairro,
                    'Cidade': parada.cidade,
                    'CEP': parada.cep,
                    'Latitude': str(parada.latitude or ''),
                    'Longitude': str(parada.longitude or ''),
                    'Tipo': parada.get_tipo_display(),
                    'Ordem': str(i + 1),
                    'Sequencia': str(parada.sequencia),
                    'Observacoes': parada.observacoes or dados_finais.get('Observacoes', ''),
                    'Total_Paradas': str(paradas.count()),
                    '_ordem': parada.sequencia,
                    '_endereco': parada.endereco or ''
                }
                
                # Atualizar dados finais com informações importantes da parada
                for key, value in dados_parada_importante.items():
                    if value:
                        dados_finais[key] = value
                
                # Adicionar sempre dados da rota
                dados_finais.update({
                    'Rota_Nome': rota.nome or '',
                    'Rota_Data': rota.data_criacao.strftime('%d/%m/%Y') if rota.data_criacao else '',
                    'Rota_Status': rota.get_status_display(),
                    'Rota_Distancia': f"{rota.distancia_total or 0} km",
                    'Rota_Tempo': f"{rota.tempo_total or 0} min",
                })
                
                dados_completos.append(dados_finais)
            else:
                # Pedido sem dados_json
                print(f"DEBUG: Pedido {pedido.numero_pedido} sem dados_json")
                dados_parada['numero_pedido'] = pedido_firebird.numero_pedido
                dados_parada['Numero pedido'] = pedido_firebird.numero_pedido
                dados_parada['Pedido'] = pedido_firebird.numero_pedido
                dados_completos.append(dados_parada)
        else:
            print(f"DEBUG: Usando apenas dados da parada para parada {i+1} (sem pedido Firebird)")
            dados_completos.append(dados_parada)
    
    print(f"DEBUG: Total de registros processados: {len(dados_completos)}")
    if dados_completos:
        print(f"DEBUG: Campos do primeiro registro: {list(dados_completos[0].keys())[:15]}...")
    
    return dados_completos


def generate_preview_pdf(layout, sample_size=5):
    """
    Gera um PDF de preview com dados reais da rota mais recente,
    buscando dados completos diretamente do Firebird.
    
    Args:
        layout: instância de LayoutReport
        sample_size: número de linhas de exemplo
        
    Returns:
        bytes: conteúdo do PDF
    """
    from rotas.models import PedidoFirebird, Rota
    
    # Tentar obter dados reais do usuário que criou o layout
    sample_data = []
    
    if hasattr(layout, 'usuario'):
        # Buscar rota mais recente do usuário
        rota_recente = Rota.objects.filter(
            usuario=layout.usuario, 
            ativo=True
        ).first()
        
        if rota_recente:
            print(f"DEBUG PREVIEW: Usando dados da rota {rota_recente.id} ({rota_recente.nome})")
            # Usar nova função que busca dados completos do Firebird
            sample_data = get_full_firebird_data_for_rota(rota_recente, limit=sample_size)
        
        # Se não tem rota, tentar pedidos Firebird recentes
        if not sample_data:
            pedidos = PedidoFirebird.objects.filter(
                usuario=layout.usuario
            ).order_by('-data_importacao')[:sample_size]
            
            for i, pedido in enumerate(pedidos):
                if pedido.dados_json:
                    record = pedido.dados_json.copy()
                    # Garantir campos básicos
                    record.update({
                        'Cliente': record.get('Cliente', pedido.cliente_nome or f'Cliente {i+1}'),
                        'Endereco': record.get('Endereco', pedido.endereco or f'Endereço {i+1}'),
                        'Telefone': record.get('Telefone', pedido.telefone or f'(47) 9999-{1000+i}'),
                        'Email': record.get('Email', pedido.email or f'cliente{i+1}@exemplo.com'),
                        '_ordem': i + 1
                    })
                    sample_data.append(record)
    
    # Se ainda não tem dados, criar dados padrão
    if not sample_data:
        layout_json = layout.get_layout_structure() if hasattr(layout, 'get_layout_structure') else layout.get('layout_json', {})
        
        # Extrair campos usados no layout
        fields_used = set()
        for band in layout_json.get('bands', []):
            for element in band.get('elements', []):
                if element.get('type') == 'field' and element.get('data_field'):
                    fields_used.add(element['data_field'])
        
        # Gerar dados de exemplo mais realistas
        for i in range(sample_size):
            record = {
                # Campos básicos de cliente
                'Cliente': f'Cliente Exemplo {i + 1}',
                'Cliente nome': f'Cliente Exemplo {i + 1}',  # Variação do nome
                'Endereco': f'Rua Exemplo, {100 + i*10}',
                'Endereco cliente': f'Rua Exemplo, {100 + i*10}',
                'Telefone': f'(47) 9999-{1000+i}',
                'Email': f'cliente{i+1}@exemplo.com',
                'Bairro': f'Bairro {i + 1}',
                'Bairro cliente': f'Bairro {i + 1}',  # Campo que está sendo usado
                'Cidade': f'Cidade {i + 1}',
                'Cidade cliente': f'Cidade {i + 1}',  # Campo que está sendo usado
                'CEP': f'89000-{100+i:03d}',
                
                # Campos de pedido
                'Pedido': f'PED{2024001 + i}',
                'Numero pedido': f'PED{2024001 + i}',
                'Codigo pedido': f'{2024001 + i}',
                'Data pedido': '2024-02-21',
                'Status': 'Pendente' if i % 2 == 0 else 'Confirmado',
                
                # Campos financeiros (valores numéricos)
                'Valor': (i+1) * 150.50,
                'Valor pedido': (i+1) * 200.75,
                'Preco': (i+1) * 25.30,
                'Quantidade': i + 1,
                'Desconto': (i+1) * 5.50,
                'Total': (i+1) * 195.25,
                
                # Campos de produto
                'Produto': f'Produto {i + 1}',
                'Descricao': f'Descrição produto {i + 1}',
                'Categoria': f'Categoria {i + 1}',
                
                # Campos de observação
                'Observacoes': f'Observação de exemplo {i + 1}',
                'Observacao venda': f'Obs venda {i + 1}',
                'Observacoes cliente': f'Obs cliente {i + 1}',
                
                # Campos de vendedor
                'Nome vendedor': f'Vendedor {i + 1}',
                'Vendedor': f'Vendedor {i + 1}',
                'Codigo vendedor': f'VEND{i+1:03d}',
                
                # Campos técnicos
                '_ordem': i + 1,
                'sequencia': i + 1,
            }
            
            # Adicionar campos específicos usados no layout
            for field in fields_used:
                if field not in record:
                    # Se o campo parece ser numérico, criar valor numérico
                    if any(keyword in field.lower() for keyword in ['valor', 'preco', 'quantidade', 'total', 'peso', 'volume', 'numero', 'codigo']):
                        if 'numero' in field.lower() or 'codigo' in field.lower():
                            record[field] = f'{field.upper()}{1000 + i}'  # Texto para códigos
                        else:
                            record[field] = (i + 1) * 10.5  # Valor numérico para valores
                    else:
                        record[field] = f'{field} exemplo {i + 1}'  # Texto genérico
            
            sample_data.append(record)
    
    print(f"DEBUG PREVIEW: Generated {len(sample_data)} sample records")
    if sample_data:
        print(f"DEBUG PREVIEW: Sample record: {sample_data[0]}")
        print(f"DEBUG PREVIEW: Numeric fields: {[k for k, v in sample_data[0].items() if isinstance(v, (int, float))]}")
    
    renderer = ReportRenderer(layout, sample_data)
    return renderer.render()
