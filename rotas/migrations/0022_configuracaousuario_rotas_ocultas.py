from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rotas', '0021_configuracaousuario_ors_api_key_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='configuracaousuario',
            name='rotas_ocultas',
            field=models.JSONField(blank=True, default=list, verbose_name='Rotas Ocultas do Painel de Pedidos'),
        ),
    ]
