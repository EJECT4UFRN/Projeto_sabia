from rest_framework.routers import DefaultRouter

from .views import EstudoViewSet, MaterialViewSet

roteador = DefaultRouter()
roteador.register("materiais", MaterialViewSet, basename="material")
roteador.register("estudo", EstudoViewSet, basename="estudo")

urlpatterns = roteador.urls
