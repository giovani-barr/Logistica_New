from django import forms
from rotas.models import Rota, Parada, ConfiguracaoUsuario


class RotaForm(forms.ModelForm):
    class Meta:
        model = Rota
        fields = ['nome', 'descricao', 'status', 'data_entrega', 'observacoes']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nome da rota'}),
            'descricao': forms.Textarea(attrs={'class': 'form-control', 'rows': 4}),
            'status': forms.Select(attrs={'class': 'form-control'}),
            'data_entrega': forms.DateInput(attrs={'class': 'form-control', 'type': 'date'}),
            'observacoes': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
        }


class ParadaForm(forms.ModelForm):
    class Meta:
        model = Parada
        fields = [
            'cliente_nome', 'cliente_telefone', 'cliente_email',
            'endereco', 'bairro', 'cidade', 'cep',
            'latitude', 'longitude', 'tipo', 'observacoes', 'tempo_estimado'
        ]
        widgets = {
            'cliente_nome': forms.TextInput(attrs={'class': 'form-control'}),
            'cliente_telefone': forms.TextInput(attrs={'class': 'form-control', 'placeholder': '(XX) 9XXXX-XXXX'}),
            'cliente_email': forms.EmailInput(attrs={'class': 'form-control'}),
            'endereco': forms.TextInput(attrs={'class': 'form-control'}),
            'bairro': forms.TextInput(attrs={'class': 'form-control'}),
            'cidade': forms.TextInput(attrs={'class': 'form-control'}),
            'cep': forms.TextInput(attrs={'class': 'form-control'}),
            'latitude': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.000001'}),
            'longitude': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.000001'}),
            'tipo': forms.Select(attrs={'class': 'form-control'}),
            'observacoes': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'tempo_estimado': forms.NumberInput(attrs={'class': 'form-control', 'min': '0'}),
        }


class ConfiguracaoUsuarioForm(forms.ModelForm):
    class Meta:
        model = ConfiguracaoUsuario
        fields = [
            'nome_empresa', 'telefone_empresa', 'email_empresa',
            'localizacao_padrao_lat', 'localizacao_padrao_lng',
            'usar_otimizacao_automatica', 'permitir_compartilhamento'
        ]
        widgets = {
            'nome_empresa': forms.TextInput(attrs={'class': 'form-control'}),
            'telefone_empresa': forms.TextInput(attrs={'class': 'form-control'}),
            'email_empresa': forms.EmailInput(attrs={'class': 'form-control'}),
            'localizacao_padrao_lat': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.000001'}),
            'localizacao_padrao_lng': forms.NumberInput(attrs={'class': 'form-control', 'step': '0.000001'}),
            'usar_otimizacao_automatica': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'permitir_compartilhamento': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }
