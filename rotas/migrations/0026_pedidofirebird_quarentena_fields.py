from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rotas', '0025_configuracaoglobal_intervalo_execucao'),
    ]

    operations = [
        migrations.AddField(
            model_name='pedidofirebird',
            name='data_arquivamento',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Data de Arquivamento'),
        ),
        migrations.AddField(
            model_name='pedidofirebird',
            name='dias_quarentena_arquivo',
            field=models.PositiveIntegerField(blank=True, null=True, verbose_name='Dias de Quarentena'),
        ),
        migrations.AddField(
            model_name='configuracaoglobal',
            name='intervalo_quarentena_horas',
            field=models.PositiveIntegerField(
                default=24,
                help_text='De quantas em quantas horas a exclusão por quarentena será verificada.',
                verbose_name='Intervalo de Quarentena (horas)',
            ),
        ),
        migrations.AddField(
            model_name='configuracaoglobal',
            name='ultima_execucao_quarentena',
            field=models.DateTimeField(blank=True, null=True, verbose_name='Última Execução da Quarentena'),
        ),
    ]
