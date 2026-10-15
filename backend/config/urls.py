from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from .views import saude

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/saude/", saude, name="saude"),
    path("api/auth/", include("usuarios.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
