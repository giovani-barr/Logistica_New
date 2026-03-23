from django.urls import path, include
from rest_framework.routers import DefaultRouter
from api.views import RotaViewSet, ParadaViewSet, ConfiguracaoViewSet, UsuarioViewSet

router = DefaultRouter()
router.register(r'rotas', RotaViewSet, basename='rota')
router.register(r'paradas', ParadaViewSet, basename='parada')
router.register(r'configuracao', ConfiguracaoViewSet, basename='configuracao')
router.register(r'usuarios', UsuarioViewSet, basename='usuario')

urlpatterns = [
    path('', include(router.urls)),
]
