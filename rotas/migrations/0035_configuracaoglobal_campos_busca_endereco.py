from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rotas', '0034_nomefixorota'),
    ]

    operations = [
        migrations.AddField(
            model_name='configuracaoglobal',
            name='campos_busca_endereco',
            field=models.JSONField(blank=True, default=list, help_text='Lista ordenada de campos do SQL usados para compor o texto de busca do endereço.', verbose_name='Campos para Busca de Endereço'),
        ),
    ]