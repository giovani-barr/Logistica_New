from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rotas', '0033_raioxaba_detail_config'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='NomeFixoRota',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nome', models.CharField(max_length=80, verbose_name='Nome da Rota')),
                ('data_criacao', models.DateTimeField(auto_now_add=True)),
                ('data_modificacao', models.DateTimeField(auto_now=True)),
                ('usuario', models.ForeignKey(on_delete=models.deletion.CASCADE, related_name='nomes_fixos_rota', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Nome Fixo de Rota',
                'verbose_name_plural': 'Nomes Fixos de Rota',
                'ordering': ['nome'],
                'unique_together': {('usuario', 'nome')},
            },
        ),
        migrations.AddIndex(
            model_name='nomefixorota',
            index=models.Index(fields=['usuario', 'nome'], name='rotas_nomef_usuario_f55233_idx'),
        ),
    ]