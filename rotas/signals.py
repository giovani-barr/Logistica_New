from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from rotas.models import ConfiguracaoUsuario


@receiver(post_save, sender=User)
def criar_configuracao_usuario(sender, instance, created, **kwargs):
    """Criar ConfiguracaoUsuario automaticamente quando um novo usuário é criado"""
    if created:
        ConfiguracaoUsuario.objects.get_or_create(usuario=instance)
