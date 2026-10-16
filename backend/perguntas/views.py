from django.db.models import Q
from rest_framework import mixins, viewsets
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from usuarios.permissoes import EhProfessor

from .models import Categoria, Pergunta
from .serializers import CategoriaSerializer, PerguntaSerializer


class PaginacaoPerguntas(PageNumberPagination):
    page_size = 10
    page_query_param = "pagina"
    page_size_query_param = "por_pagina"
    max_page_size = 50


class CategoriaViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Categorias do professor logado (lista e "Nova categoria")."""

    serializer_class = CategoriaSerializer
    permission_classes = [EhProfessor]
    pagination_class = None

    def get_queryset(self):
        return Categoria.objects.filter(dono=self.request.user)

    def perform_create(self, serializer):
        serializer.save(dono=self.request.user)


class PerguntaViewSet(viewsets.ModelViewSet):
    """Banco de perguntas do professor logado.

    Filtros: ?busca= (texto da pergunta), ?categoria=<id>, ?dificuldade=facil|medio|dificil,
    ?ativa=true|false. Paginação: ?pagina=N (10 por página).
    """

    serializer_class = PerguntaSerializer
    permission_classes = [EhProfessor]
    pagination_class = PaginacaoPerguntas
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        perguntas = Pergunta.objects.filter(dono=self.request.user).select_related("categoria")
        filtros = self.request.query_params

        busca = " ".join(filtros.get("busca", "").split())
        if busca:
            perguntas = perguntas.filter(Q(texto__icontains=busca) | Q(categoria__nome__icontains=busca))

        categoria = filtros.get("categoria")
        if categoria and categoria.isdigit():
            perguntas = perguntas.filter(categoria_id=categoria)

        dificuldade = filtros.get("dificuldade")
        if dificuldade in Pergunta.Dificuldade.values:
            perguntas = perguntas.filter(dificuldade=dificuldade)

        ativa = filtros.get("ativa")
        if ativa in {"true", "false"}:
            perguntas = perguntas.filter(ativa=ativa == "true")

        return perguntas

    def perform_destroy(self, pergunta):
        # Regra confirmada: pergunta que já está em algum quiz não pode ser excluída
        # (deve ser inativada). A verificação entra junto com o app de quizzes.
        if pergunta.imagem:
            pergunta.imagem.delete(save=False)
        pergunta.delete()
