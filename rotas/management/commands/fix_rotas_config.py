"""
Comando para corrigir configurações de cards de rota com valores padrão
"""
from django.core.management.base import BaseCommand
from rotas.models import ConfiguracaoUsuario


class Command(BaseCommand):
    help = 'Corrige configurações de cards de rota com valores padrão'

    def handle(self, *args, **options):
        configs = ConfiguracaoUsuario.objects.all()
        count = 0
        
        for config in configs:
            updated = False
            
            # Garantir que os valores booleanos sejam True por padrão
            if config.rotas_card_mostrar_numero is None:
                config.rotas_card_mostrar_numero = True
                updated = True
            
            if config.rotas_card_mostrar_endereco is None:
                config.rotas_card_mostrar_endereco = True
                updated = True
            
            if config.rotas_card_mostrar_obs is None:
                config.rotas_card_mostrar_obs = True
                updated = True
            
            # Garantir que cores e tamanhos tenham valores padrão
            if not config.rotas_card_cor_fundo:
                config.rotas_card_cor_fundo = '#ffffff'
                updated = True
            
            if not config.rotas_card_cor_borda:
                config.rotas_card_cor_borda = '#dadce0'
                updated = True
            
            if not config.rotas_card_cor_numero:
                config.rotas_card_cor_numero = '#4285F4'
                updated = True
            
            if updated:
                config.save()
                count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Configuração atualizada para usuário: {config.usuario.username}'
                    )
                )
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Concluído! {count} configuração(ões) atualizada(s).'
            )
        )
