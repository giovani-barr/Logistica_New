from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('rotas', '0015_configuracaousuario_permitir_pedido_multiplas_rotas'),
    ]

    operations = [
        migrations.AddField(
            model_name='conexaofirebird',
            name='importacao_automatica',
            field=models.BooleanField(default=False, verbose_name='Importação automática'),
        ),
        migrations.AddField(
            model_name='conexaofirebird',
            name='importacao_intervalo_segundos',
            field=models.IntegerField(
                default=120,
                validators=[
                    django.core.validators.MinValueValidator(30),
                    django.core.validators.MaxValueValidator(21600)
                ],
                verbose_name='Intervalo da importação automática (segundos)'
            ),
        ),
    ]
