from django import forms
from django.contrib.auth.models import User
from .models import ConexaoFirebird, QueryFirebird, PedidoFirebird
import fdb


class ConexaoFirebirdForm(forms.ModelForm):
    """Formulário para configurar conexão com Firebird"""
    senha_banco = forms.CharField(
        widget=forms.PasswordInput(render_value=True, attrs={
            'class': 'form-control',
            'placeholder': 'Senha do Firebird'
        }),
        label='Senha Firebird',
        required=True
    )
    
    class Meta:
        model = ConexaoFirebird
        fields = [
            'nome_conexao', 'host', 'porta', 'caminho_banco', 'usuario_banco', 'senha_banco',
            'charset', 'ativo', 'importacao_automatica', 'importacao_intervalo_segundos'
        ]
        widgets = {
            'nome_conexao': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ex: Banco Principal'
            }),
            'host': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ex: 192.168.1.100 ou localhost'
            }),
            'porta': forms.NumberInput(attrs={
                'class': 'form-control',
                'value': 3050
            }),
            'caminho_banco': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ex: C:\\Firebird\\database.fdb'
            }),
            'usuario_banco': forms.TextInput(attrs={
                'class': 'form-control',
                'value': 'SYSDBA'
            }),
            'charset': forms.TextInput(attrs={
                'class': 'form-control',
                'value': 'UTF8'
            }),
            'ativo': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
            'importacao_automatica': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            }),
            'importacao_intervalo_segundos': forms.NumberInput(attrs={
                'class': 'form-control',
                'min': 30,
                'max': 21600,
                'placeholder': 120
            }),
        }

    def clean(self):
        cleaned = super().clean()
        auto = cleaned.get('importacao_automatica')
        intervalo = cleaned.get('importacao_intervalo_segundos')
        if auto:
            if intervalo is None:
                self.add_error('importacao_intervalo_segundos', 'Informe o intervalo em segundos.')
            else:
                if intervalo < 30 or intervalo > 21600:
                    self.add_error('importacao_intervalo_segundos', 'Use um valor entre 30 e 21600 segundos.')
        return cleaned


class QueryFirebirdForm(forms.ModelForm):
    """Formulário para criar/editar queries do Firebird"""
    
    class Meta:
        model = QueryFirebird
        fields = [
            'nome_query', 'descricao', 'sql',
            'campo_pedido', 'campo_cliente', 'campo_entregador',
            'campo_latitude', 'campo_longitude', 'campo_descricao',
            'campo_endereco', 'campo_telefone', 'campo_email',
            'ativo'
        ]
        widgets = {
            'nome_query': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: Pedidos para Entrega'}),
            'descricao': forms.Textarea(attrs={'class': 'form-control', 'rows': 2, 'placeholder': 'Descrição da query'}),
            'sql': forms.Textarea(attrs={'class': 'form-control', 'rows': 8, 'placeholder': 'SELECT ...', 'style': 'font-family: monospace; font-size: 13px;'}),
            
            'campo_pedido': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: PEDIDO'}),
            'campo_cliente': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: Nome cliente'}),
            'campo_entregador': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: Entregador (opcional)'}),
            'campo_latitude': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: LATITUDE'}),
            'campo_longitude': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: LONGITUDE'}),
            'campo_descricao': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: Descrição (opcional)'}),
            'campo_endereco': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: Endereco cliente'}),
            'campo_telefone': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: Telefone (opcional)'}),
            'campo_email': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Ex: Email (opcional)'}),
            
            'ativo': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }


class TestConexaoForm(forms.Form):
    """Formulário para testar a conexão com Firebird"""
    pass


class ImportarPedidosForm(forms.Form):
    """Formulário para importar pedidos do Firebird"""
    query = forms.ModelChoiceField(
        queryset=QueryFirebird.objects.none(),
        widget=forms.Select(attrs={
            'class': 'form-control'
        }),
        label='Query'
    )
    
    def __init__(self, usuario, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['query'].queryset = QueryFirebird.objects.filter(
            usuario=usuario, ativo=True
        )
