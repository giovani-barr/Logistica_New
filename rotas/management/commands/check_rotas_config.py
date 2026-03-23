"""
Comando para verificar configurações de cards de rota
"""
from django.core.management.base import BaseCommand
from rotas.models import ConfiguracaoUsuario


class Command(BaseCommand):
    help = 'Verifica configurações de cards de rota'

    def handle(self, *args, **options):
        configs = ConfiguracaoUsuario.objects.all()
        
        if not configs.exists():
            self.stdout.write(
                self.style.WARNING('Nenhuma configuração encontrada no banco de dados.')
            )
            return
        
        for config in configs:
            self.stdout.write('')
            self.stdout.write(
                self.style.SUCCESS(f'Usuário: {config.usuario.username}')
            )
            self.stdout.write(f'  rotas_card_mostrar_numero: {config.rotas_card_mostrar_numero}')
            self.stdout.write(f'  rotas_card_mostrar_endereco: {config.rotas_card_mostrar_endereco}')
            self.stdout.write(f'  rotas_card_mostrar_obs: {config.rotas_card_mostrar_obs}')
            self.stdout.write(f'  rotas_card_cor_fundo: {config.rotas_card_cor_fundo}')
            self.stdout.write(f'  rotas_card_cor_borda: {config.rotas_card_cor_borda}')
            self.stdout.write(f'  rotas_card_cor_numero: {config.rotas_card_cor_numero}')
            self.stdout.write(f'  rotas_card_tamanho_fonte: {config.rotas_card_tamanho_fonte}')
            self.stdout.write(f'  rotas_card_padding_vertical: {config.rotas_card_padding_vertical}')
            self.stdout.write(f'  rotas_card_padding_horizontal: {config.rotas_card_padding_horizontal}')
            self.stdout.write(f'  rotas_card_raio: {config.rotas_card_raio}')
