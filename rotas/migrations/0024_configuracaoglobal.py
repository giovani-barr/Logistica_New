from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rotas', '0023_configuracaousuario_filtros_exclusao_pedidos'),
    ]

    operations = [
        migrations.CreateModel(
            name='ConfiguracaoGlobal',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('regras_arquivamento_pedidos', models.JSONField(blank=True, default=list, verbose_name='Regras de Arquivamento Automático de Pedidos')),
            ],
            options={
                'verbose_name': 'Configuração Global',
                'verbose_name_plural': 'Configurações Globais',
            },
        ),
    ]
