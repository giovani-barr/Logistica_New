# Generated migration for new RaioXAba fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rotas', '0031_raioxaba_layout_config'),
    ]

    operations = [
        migrations.AddField(
            model_name='raioxaba',
            name='pivot_config',
            field=models.JSONField(blank=True, default=dict, verbose_name='Configuração de Pivot'),
        ),
        migrations.AddField(
            model_name='raioxaba',
            name='widget_configs',
            field=models.JSONField(blank=True, default=dict, verbose_name='Widgets de Campo'),
        ),
        migrations.AddField(
            model_name='raioxaba',
            name='sqls_extras',
            field=models.JSONField(blank=True, default=list, verbose_name='SQLs Adicionais'),
        ),
    ]
