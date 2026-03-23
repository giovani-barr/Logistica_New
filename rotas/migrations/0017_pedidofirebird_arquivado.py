from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rotas', '0016_conexaofirebird_importacao_automatica'),
    ]

    operations = [
        migrations.AddField(
            model_name='pedidofirebird',
            name='arquivado',
            field=models.BooleanField(default=False, verbose_name='Arquivado'),
        ),
        migrations.AddField(
            model_name='pedidofirebird',
            name='motivo_arquivo',
            field=models.CharField(blank=True, max_length=255, null=True, verbose_name='Motivo do Arquivo'),
        ),
    ]
