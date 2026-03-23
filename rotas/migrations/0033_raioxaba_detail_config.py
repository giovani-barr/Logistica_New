from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rotas', '0032_raioxaba_pivot_widget_sqlsextras'),
    ]

    operations = [
        migrations.AddField(
            model_name='raioxaba',
            name='detail_config',
            field=models.JSONField(blank=True, default=dict, verbose_name='Configuração de Painel de Detalhe'),
        ),
    ]
