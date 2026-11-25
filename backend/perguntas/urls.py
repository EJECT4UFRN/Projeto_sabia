from rest_framework.routers import DefaultRouter

from .views import CategoriaViewSet, PerguntaViewSet

roteador = DefaultRouter()
roteador.register("categorias", CategoriaViewSet, basename="categoria")
roteador.register("perguntas", PerguntaViewSet, basename="pergunta")

urlpatterns = roteador.urls
