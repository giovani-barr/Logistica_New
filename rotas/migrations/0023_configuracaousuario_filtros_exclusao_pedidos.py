from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rotas', '0022_configuracaousuario_rotas_ocultas'),
    ]

    operations = [
        migrations.AddField(
            model_name='configuracaousuario',
            name='filtros_exclusao_pedidos',
            field=models.JSONField(blank=True, default=list, verbose_name='Filtros de Exclusão de Pedidos'),
        ),
    ]
