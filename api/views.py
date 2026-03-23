from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from django.db.models import Sum, Avg
from rotas.models import Rota, Parada, RotaHistorico, ConfiguracaoUsuario
from django.contrib.auth.models import User
from api.serializers import (
    RotaSerializer, RotaListSerializer, ParadaSerializer,
    RotaHistoricoSerializer, ConfiguracaoUsuarioSerializer, UserSerializer
)
import csv
from io import StringIO, BytesIO
from django.http import HttpResponse
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib import colors
import requests


class RotaViewSet(viewsets.ModelViewSet):
    serializer_class = RotaSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'data_entrega', 'ativo']
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return Rota.objects.all()
        return Rota.objects.filter(usuario=self.request.user)
    
    def get_serializer_class(self):
        if self.action == 'list':
            return RotaListSerializer
        return RotaSerializer
    
    def perform_create(self, serializer):
        serializer.save(usuario=self.request.user)
    
    @action(detail=True, methods=['get'])
    def paradas(self, request, pk=None):
        """Retorna todas as paradas de uma rota"""
        rota = self.get_object()
        paradas = rota.paradas.all()
        serializer = ParadaSerializer(paradas, many=True)
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def adicionar_parada(self, request, pk=None):
        """Adiciona uma parada à rota"""
        rota = self.get_object()
        serializer = ParadaSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(rota=rota)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['post'])
    def otimizar_rota(self, request, pk=None):
        """Otimiza a ordem das paradas usando algoritmo 2-Opt"""
        rota = self.get_object()
        paradas = rota.paradas.all().order_by('sequencia')
        
        if paradas.count() < 3:
            return Response(
                {'erro': 'Adicione pelo menos 3 paradas para otimizar'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Implementar algoritmo de otimização
        try:
            pontos = [(p.latitude, p.longitude) for p in paradas]
            rota_otimizada = self._otimizar_2opt(pontos, paradas)
            
            # Atualizar sequências
            for idx, parada in enumerate(rota_otimizada, start=1):
                parada.sequencia = idx
                parada.save()
            
            self._adicionar_historico(rota, 'otimizacao', 'Rota otimizada automaticamente')
            
            return Response({
                'mensagem': 'Rota otimizada com sucesso',
                'paradas': ParadaSerializer(rota_otimizada, many=True).data
            })
        except Exception as e:
            return Response(
                {'erro': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def calcular_rota(self, request, pk=None):
        """Calcula distância e tempo total da rota via OSRM"""
        rota = self.get_object()
        paradas = rota.paradas.all().order_by('sequencia')
        
        if paradas.count() < 2:
            return Response(
                {'erro': 'A rota precisa ter pelo menos 2 paradas'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            coords = ';'.join([f"{p.longitude},{p.latitude}" for p in paradas])
            osrm_url = f"https://router.project-osrm.org/route/v1/driving/{coords}?overview=false"
            
            response = requests.get(osrm_url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if data['code'] == 'Ok':
                rota.distancia_total = round(data['routes'][0]['distance'] / 1000, 2)
                rota.tempo_total = round(data['routes'][0]['duration'] / 60)
                rota.save()
                
                return Response({
                    'distancia_total': rota.distancia_total,
                    'tempo_total': rota.tempo_total
                })
            else:
                return Response(
                    {'erro': 'Não foi possível calcular a rota'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            return Response(
                {'erro': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def exportar_pdf(self, request, pk=None):
        """Exporta a rota em PDF"""
        rota = self.get_object()
        paradas = rota.paradas.all().order_by('sequencia')
        
        # Criar PDF
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
        story = []
        styles = getSampleStyleSheet()
        
        # Título
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=20,
            textColor=colors.HexColor('#4285F4'),
            spaceAfter=10,
        )
        story.append(Paragraph(f"🚛 Rota: {rota.nome}", title_style))
        story.append(Spacer(1, 0.2*inch))
        
        # Informações gerais
        info_data = [
            ['Informação', 'Valor'],
            ['Data de Criação', rota.data_criacao.strftime('%d/%m/%Y %H:%M')],
            ['Status', rota.get_status_display()],
            ['Distância Total', f"{rota.distancia_total or '---'} km"],
            ['Tempo Total', f"{rota.tempo_total or '---'} minutos"],
        ]
        info_table = Table(info_data, colWidths=[2*inch, 3*inch])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4285F4')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        story.append(info_table)
        story.append(Spacer(1, 0.3*inch))
        
        # Paradas
        story.append(Paragraph("Paradas da Rota", styles['Heading2']))
        story.append(Spacer(1, 0.1*inch))
        
        paradas_data = [['#', 'Cliente', 'Endereço', 'Observações']]
        for parada in paradas:
            paradas_data.append([
                str(parada.sequencia),
                parada.cliente_nome,
                parada.endereco,
                parada.observacoes or '---'
            ])
        
        paradas_table = Table(paradas_data, colWidths=[0.5*inch, 1.5*inch, 2*inch, 1.5*inch])
        paradas_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#4285F4')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 11),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey])
        ]))
        story.append(paradas_table)
        
        doc.build(story)
        buffer.seek(0)
        
        return HttpResponse(
            buffer.getvalue(),
            content_type='application/pdf',
            headers={'Content-Disposition': f'attachment; filename="rota_{rota.id}.pdf"'}
        )
    
    @action(detail=True, methods=['post'], parser_classes=(MultiPartParser, FormParser))
    def importar_csv(self, request, pk=None):
        """Importa paradas de um arquivo CSV"""
        rota = self.get_object()
        
        if 'arquivo' not in request.FILES:
            return Response(
                {'erro': 'Nenhum arquivo enviado'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            arquivo = request.FILES['arquivo']
            file_data = arquivo.read().decode('utf-8')
            reader = csv.DictReader(StringIO(file_data), delimiter=';' if ';' in file_data[:100] else ',')
            
            paradas_criadas = 0
            for row in reader:
                try:
                    parada = Parada(
                        rota=rota,
                        sequencia=paradas_criadas + 1,
                        cliente_nome=row.get('cliente_nome', 'Sem nome'),
                        cliente_telefone=row.get('cliente_telefone', ''),
                        cliente_email=row.get('cliente_email', ''),
                        endereco=row.get('endereco', ''),
                        bairro=row.get('bairro', ''),
                        cidade=row.get('cidade', ''),
                        cep=row.get('cep', ''),
                        latitude=float(row.get('latitude', 0)),
                        longitude=float(row.get('longitude', 0)),
                        tipo=row.get('tipo', 'entrega'),
                        observacoes=row.get('observacoes', ''),
                    )
                    parada.save()
                    paradas_criadas += 1
                except (ValueError, KeyError) as e:
                    continue
            
            self._adicionar_historico(rota, 'importacao_csv', f'{paradas_criadas} paradas importadas')
            
            return Response({
                'mensagem': f'{paradas_criadas} paradas importadas com sucesso',
                'paradas_criadas': paradas_criadas
            })
        except Exception as e:
            return Response(
                {'erro': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['get'])
    def historico(self, request, pk=None):
        """Retorna o histórico de modificações da rota"""
        rota = self.get_object()
        historicos = rota.historicos.all()
        serializer = RotaHistoricoSerializer(historicos, many=True)
        return Response(serializer.data)
    
    def _otimizar_2opt(self, pontos, paradas):
        """Algoritmo 2-Opt simplificado"""
        def distancia(p1, p2):
            lat1, lng1 = pontos[paradas.index(p1)]
            lat2, lng2 = pontos[paradas.index(p2)]
            return ((lat1-lat2)**2 + (lng1-lng2)**2)**0.5
        
        lista = list(paradas)
        melhorado = True
        
        while melhorado:
            melhorado = False
            for i in range(len(lista)-2):
                for j in range(i+1, len(lista)-1):
                    delta = (distancia(lista[i], lista[j]) + 
                            distancia(lista[i+1], lista[j+1]) - 
                            distancia(lista[i], lista[i+1]) - 
                            distancia(lista[j], lista[j+1]))
                    if delta < 0:
                        lista[i+1:j+1] = reversed(lista[i+1:j+1])
                        melhorado = True
        
        return lista
    
    def _adicionar_historico(self, rota, acao, descricao):
        """Adiciona entrada ao histórico da rota"""
        RotaHistorico.objects.create(
            rota=rota,
            usuario=self.request.user,
            acao=acao,
            descricao=descricao
        )


class ParadaViewSet(viewsets.ModelViewSet):
    serializer_class = ParadaSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['rota', 'tipo']
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return Parada.objects.all()
        return Parada.objects.filter(rota__usuario=self.request.user)
    
    def perform_create(self, serializer):
        parada = serializer.save()
        self._adicionar_historico_parada(parada.rota, 'nova_parada', f'Parada adicionada: {parada.cliente_nome}')
    
    def _adicionar_historico_parada(self, rota, acao, descricao):
        RotaHistorico.objects.create(
            rota=rota,
            usuario=self.request.user,
            acao=acao,
            descricao=descricao
        )


class ConfiguracaoViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get', 'put'])
    def minha_configuracao(self, request):
        """Retorna ou atualiza a configuração do usuário atual"""
        config, created = ConfiguracaoUsuario.objects.get_or_create(usuario=request.user)
        
        if request.method == 'PUT':
            serializer = ConfiguracaoUsuarioSerializer(config, data=request.data, partial=True)
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = ConfiguracaoUsuarioSerializer(config)
        return Response(serializer.data)


class UsuarioViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def meu_perfil(self, request):
        """Retorna os dados do usuário autenticado"""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
