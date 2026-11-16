"""
Routage racine : l'admin Django sous /admin/, l'API sous /api/.

L'interface React est servie séparément (Vite en dev, nginx en prod) ;
Django ne sert aucune page HTML hors admin.
"""

from django.contrib import admin
from django.urls import path

from config.api import api

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
]
