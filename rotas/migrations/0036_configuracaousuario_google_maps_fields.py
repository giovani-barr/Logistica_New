from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('rotas', '0035_configuracaoglobal_campos_busca_endereco'),
    ]

    operations = [
        migrations.AddField(
            model_name='configuracaousuario',
            name='google_maps_api_key',
            field=models.CharField(blank=True, default='', max_length=255, verbose_name='Chave API Google Maps'),
        ),
        migrations.AddField(
            model_name='configuracaousuario',
            name='google_maps_search_country',
            field=models.CharField(blank=True, default='br', max_length=10, verbose_name='País padrão da busca Google Maps'),
        ),
    ]