"""
Management command para executar a quarentena — exclusão permanente de pedidos arquivados vencidos.

Uso:
    python manage.py limpar_quarentena           # respeita o intervalo configurado
    python manage.py limpar_quarentena --force   # executa independente do intervalo
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from rotas.models import ConfiguracaoGlobal
from rotas.views import _executar_quarentena_global


class Command(BaseCommand):
    help = 'Exclui permanentemente pedidos arquivados que ultrapassaram o prazo de quarentena.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Executa mesmo se o intervalo ainda não tiver passado.',
        )

    def handle(self, *args, **options):
        cfg_global = ConfiguracaoGlobal.get_instance()

        if not options['force']:
            agora = timezone.now()
            ultima = cfg_global.ultima_execucao_quarentena
            intervalo_h = cfg_global.intervalo_quarentena_horas or 24
            if ultima is not None and (agora - ultima).total_seconds() < intervalo_h * 3600:
                horas_restantes = intervalo_h - (agora - ultima).total_seconds() / 3600
                self.stdout.write(
                    self.style.WARNING(
                        f'Intervalo ainda não atingido. Próxima verificação em '
                        f'{horas_restantes:.1f}h. Use --force para forçar.'
                    )
                )
                return

        count = _executar_quarentena_global()
        cfg_global.ultima_execucao_quarentena = timezone.now()
        cfg_global.save(update_fields=['ultima_execucao_quarentena'])
        self.stdout.write(
            self.style.SUCCESS(f'{count} pedido(s) excluído(s) permanentemente pela quarentena.')
        )
