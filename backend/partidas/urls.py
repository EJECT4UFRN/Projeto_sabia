from rest_framework.routers import DefaultRouter

from .views import PartidaViewSet

roteador = DefaultRouter()
roteador.register("partidas", PartidaViewSet, basename="partida")

urlpatterns = roteador.urls
