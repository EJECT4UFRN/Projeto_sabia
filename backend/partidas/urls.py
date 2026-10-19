from django.urls import path
from rest_framework.routers import DefaultRouter

from .historico import HistoricoView, ResumoPartidaView, RetomarPartidaView
from .views import PartidaViewSet

roteador = DefaultRouter()
roteador.register("partidas", PartidaViewSet, basename="partida")

urlpatterns = [
    path("historico/", HistoricoView.as_view(), name="historico"),
    path("historico/<int:participacao_id>/", ResumoPartidaView.as_view(), name="historico-resumo"),
    path("historico/<int:participacao_id>/retomar/", RetomarPartidaView.as_view(), name="historico-retomar"),
    *roteador.urls,
]
