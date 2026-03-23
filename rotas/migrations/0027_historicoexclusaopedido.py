from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rotas', '0026_pedidofirebird_quarentena_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='HistoricoExclusaoPedido',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('numero_pedido', models.CharField(max_length=100, verbose_name='Número do Pedido')),
                ('cliente_nome', models.CharField(max_length=255, verbose_name='Nome do Cliente')),
                ('entregador', models.CharField(blank=True, max_length=255, null=True, verbose_name='Entregador')),
                ('endereco', models.CharField(blank=True, max_length=500, null=True, verbose_name='Endereço')),
                ('dados_json', models.JSONField(blank=True, default=dict, verbose_name='Dados Completos')),
                ('data_importacao', models.DateTimeField(blank=True, null=True, verbose_name='Data de Importação')),
                ('data_arquivamento', models.DateTimeField(blank=True, null=True, verbose_name='Data de Arquivamento')),
                ('dias_quarentena', models.PositiveIntegerField(blank=True, null=True, verbose_name='Dias de Quarentena')),
                ('data_exclusao', models.DateTimeField(auto_now_add=True, verbose_name='Data de Exclusão')),
                ('regra_aplicada', models.JSONField(blank=True, default=dict, verbose_name='Regra Aplicada')),
            ],
            options={
                'verbose_name': 'Histórico de Exclusão de Pedido',
                'verbose_name_plural': 'Histórico de Exclusões de Pedidos',
                'ordering': ['-data_exclusao'],
            },
        ),
    ]
