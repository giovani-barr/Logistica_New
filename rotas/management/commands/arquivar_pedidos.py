"""
Management command para executar o arquivamento automático de pedidos.

Uso:
    python manage.py arquivar_pedidos           # respeita o intervalo configurado
    python manage.py arquivar_pedidos --force   # executa independente do intervalo
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from rotas.models import ConfiguracaoGlobal
from rotas.views import _executar_arquivamento_global


class Command(BaseCommand):
    help = 'Arquiva pedidos conforme as regras de arquivamento automático configuradas.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Executa mesmo se o intervalo ainda não tiver passado.',
        )

    def handle(self, *args, **options):
        cfg_global = ConfiguracaoGlobal.get_instance()
        regras_ativas = [
            r for r in (cfg_global.regras_arquivamento_pedidos or [])
            if isinstance(r, dict) and r.get('ativo', True)
        ]

        if not regras_ativas:
            self.stdout.write(self.style.WARNING('Nenhuma regra de arquivamento ativa. Nada a fazer.'))
            return

        if not options['force']:
            agora = timezone.now()
            ultima = cfg_global.ultima_execucao_arquivamento
            intervalo_h = cfg_global.intervalo_arquivamento_horas or 24
            if ultima is not None and (agora - ultima).total_seconds() < intervalo_h * 3600:
                horas_restantes = intervalo_h - (agora - ultima).total_seconds() / 3600
                self.stdout.write(
                    self.style.WARNING(
                        f'Intervalo ainda não atingido. Próxima execução em '
                        f'{horas_restantes:.1f}h. Use --force para forçar.'
                    )
                )
                return

        count = _executar_arquivamento_global(cfg_global)
        cfg_global.ultima_execucao_arquivamento = timezone.now()
        cfg_global.save(update_fields=['ultima_execucao_arquivamento'])
        self.stdout.write(
            self.style.SUCCESS(f'{count} pedido(s) arquivado(s) com sucesso.')
        )
