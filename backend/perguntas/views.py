from django.db.models import Count, Q
from rest_framework import mixins, status, viewsets
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

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
        # Cópias exclusivas de quiz (no_banco=False) só são vistas e editadas pelo quiz.
        perguntas = (
            Pergunta.objects.filter(dono=self.request.user, no_banco=True)
            .select_related("categoria")
            .annotate(em_quizzes=Count("usos"))
            .order_by("-atualizada_em", "-id")
        )
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

    def destroy(self, request, *args, **kwargs):
        # Regra confirmada: pergunta que já está em algum quiz não pode ser excluída, só desativada.
        pergunta = self.get_object()
        if pergunta.usos.exists():
            return Response(
                {"detail": "Esta pergunta está em um ou mais quizzes. Desative-a em vez de excluir."},
                status=status.HTTP_409_CONFLICT,
            )
        pergunta.excluir_com_imagem()
        return Response(status=status.HTTP_204_NO_CONTENT)
