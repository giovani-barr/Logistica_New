from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rotas', '0024_configuracaoglobal'),
    ]

    operations = [
        migrations.AddField(
            model_name='configuracaoglobal',
            name='intervalo_arquivamento_horas',
            field=models.PositiveIntegerField(
                default=24,
                help_text='De quantas em quantas horas o arquivamento automático será executado.',
                verbose_name='Intervalo de Arquivamento (horas)',
            ),
        ),
        migrations.AddField(
            model_name='configuracaoglobal',
            name='ultima_execucao_arquivamento',
            field=models.DateTimeField(
                blank=True,
                null=True,
                verbose_name='Última Execução do Arquivamento',
            ),
        ),
    ]
