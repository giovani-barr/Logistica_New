from rest_framework import serializers
from rotas.models import Rota, Parada, RotaHistorico, ConfiguracaoUsuario
from django.contrib.auth.models import User


class ParadaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Parada
        fields = [
            'id', 'sequencia', 'cliente_nome', 'cliente_telefone', 'cliente_email',
            'endereco', 'bairro', 'cidade', 'cep', 'latitude', 'longitude',
            'tipo', 'observacoes', 'tempo_estimado', 'data_criacao', 'data_modificacao'
        ]
        read_only_fields = ['id', 'data_criacao', 'data_modificacao']


class RotaSerializer(serializers.ModelSerializer):
    paradas = ParadaSerializer(many=True, read_only=True)
    usuario_nome = serializers.CharField(source='usuario.get_full_name', read_only=True)
    
    class Meta:
        model = Rota
        fields = [
            'id', 'usuario', 'usuario_nome', 'nome', 'descricao', 'data_criacao',
            'data_modificacao', 'data_entrega', 'status', 'distancia_total',
            'tempo_total', 'observacoes', 'ativo', 'paradas'
        ]
        read_only_fields = ['id', 'usuario', 'data_criacao', 'data_modificacao']


class RotaListSerializer(serializers.ModelSerializer):
    usuario_nome = serializers.CharField(source='usuario.get_full_name', read_only=True)
    num_paradas = serializers.SerializerMethodField()
    
    class Meta:
        model = Rota
        fields = [
            'id', 'nome', 'usuario_nome', 'status', 'data_criacao',
            'distancia_total', 'tempo_total', 'num_paradas'
        ]
    
    def get_num_paradas(self, obj):
        return obj.paradas.count()


class RotaHistoricoSerializer(serializers.ModelSerializer):
    usuario_nome = serializers.CharField(source='usuario.get_full_name', read_only=True)
    
    class Meta:
        model = RotaHistorico
        fields = ['id', 'usuario_nome', 'acao', 'descricao', 'data_hora']
        read_only_fields = ['id', 'data_hora']


class ConfiguracaoUsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracaoUsuario
        fields = [
            'id', 'localizacao_padrao_lat', 'localizacao_padrao_lng',
            'nome_empresa', 'telefone_empresa', 'email_empresa',
            'usar_otimizacao_automatica', 'permitir_compartilhamento'
        ]


class UserSerializer(serializers.ModelSerializer):
    configuracao = ConfiguracaoUsuarioSerializer(source='configuracao_logistica', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'configuracao']
        read_only_fields = ['id']
