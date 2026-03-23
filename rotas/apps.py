from django.apps import AppConfig


class RotasConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'rotas'
    verbose_name = 'Gerenciador de Rotas'
    
    def ready(self):
        import rotas.signals
