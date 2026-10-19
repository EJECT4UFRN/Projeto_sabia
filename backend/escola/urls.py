from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import BuscaAlunosView, DisciplinaViewSet, MinhasTurmasViewSet, TurmaViewSet

roteador = DefaultRouter()
roteador.register("disciplinas", DisciplinaViewSet, basename="disciplina")
roteador.register("turmas", TurmaViewSet, basename="turma")
roteador.register("minhas-turmas", MinhasTurmasViewSet, basename="minha-turma")

urlpatterns = [
    path("alunos/", BuscaAlunosView.as_view(), name="busca-alunos"),
    *roteador.urls,
]
