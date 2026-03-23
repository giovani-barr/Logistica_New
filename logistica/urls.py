"""
URL configuration for logistica_project project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include(('rotas.urls', 'rotas'), namespace='rotas')),
    path('api/', include('api.urls')),
    path('api-auth/', include('rest_framework.urls', namespace='rest_framework')),
    path('accounts/', include('django.contrib.auth.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

admin.site.site_header = "Fermap Logística - Administração"
admin.site.site_title = "Fermap Admin"
admin.site.index_title = "Bem-vindo ao Gerenciador de Rotas"
