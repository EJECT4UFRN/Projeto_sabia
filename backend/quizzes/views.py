from django.db import transaction
from django.db.models import Count, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from perguntas.models import Pergunta
from perguntas.serializers import PerguntaSerializer
from usuarios.permissoes import EhProfessor

from .models import Quiz, QuizPergunta
from .serializers import PerguntaDoQuizSerializer, QuizResumoSerializer, QuizSerializer


class PaginacaoQuizzes(PageNumberPagination):
    page_size = 6
    page_query_param = "pagina"
    page_size_query_param = "por_pagina"
    max_page_size = 50


class QuizViewSet(viewsets.ModelViewSet):
    """ "Meus jogos" do professor logado.

    Filtros: ?busca= (título ou disciplina), ?disciplina=<id>, ?status=rascunho|publicado,
    ?dificuldade=facil|medio|dificil, ?favorito=true. Paginação: ?pagina=N (6 por página).
    """

    permission_classes = [EhProfessor]
    pagination_class = PaginacaoQuizzes
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_serializer_class(self):
        return QuizResumoSerializer if self.action == "list" else QuizSerializer

    def get_queryset(self):
        quizzes = Quiz.objects.filter(dono=self.request.user).select_related("disciplina")
        if self.action != "list":
            return quizzes

        quizzes = quizzes.annotate(
            perguntas_total=Count("itens", distinct=True),
            partidas_realizadas=Count("partidas", filter=Q(partidas__estado="encerrada"), distinct=True),
        ).order_by("-atualizado_em", "-id")
        filtros = self.request.query_params

        busca = " ".join(filtros.get("busca", "").split())
        if busca:
            quizzes = quizzes.filter(
                Q(titulo__icontains=busca) | Q(disciplina__chave__contains=busca.casefold())
            )

        if filtros.get("disciplina", "").isdigit():
            quizzes = quizzes.filter(disciplina_id=filtros["disciplina"])

        if filtros.get("status") in Quiz.Status.values:
            quizzes = quizzes.filter(status=filtros["status"])

        if filtros.get("dificuldade") in Pergunta.Dificuldade.values:
            quizzes = quizzes.filter(dificuldade=filtros["dificuldade"])

        if filtros.get("favorito") == "true":
            quizzes = quizzes.filter(favorito=True)

        return quizzes

    @transaction.atomic
    def perform_destroy(self, quiz):
        exclusivas = list(quiz.perguntas_exclusivas())
        quiz.delete()
        for pergunta in exclusivas:
            pergunta.excluir_com_imagem()

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def duplicar(self, request, pk=None):
        """Cria uma cópia em rascunho, com cópias das perguntas só para ela."""
        original = self.get_object()
        copia = Quiz.objects.create(
            dono=request.user,
            titulo=f"{original.titulo} (cópia)"[:120],
            descricao=original.descricao,
            disciplina=original.disciplina,
            turma=original.turma,
            dificuldade=original.dificuldade,
            tempo_padrao=original.tempo_padrao,
            pontuacao_padrao=original.pontuacao_padrao,
            embaralhar_perguntas=original.embaralhar_perguntas,
            embaralhar_respostas=original.embaralhar_respostas,
        )
        QuizPergunta.objects.bulk_create(
            QuizPergunta(quiz=copia, pergunta=item.pergunta.copiar(), ordem=item.ordem)
            for item in original.itens.select_related("pergunta")
        )
        serializer = QuizSerializer(copia, context=self.get_serializer_context())
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["patch"], url_path=r"perguntas/(?P<pergunta_id>\d+)")
    @transaction.atomic
    def editar_pergunta(self, request, pk=None, pergunta_id=None):
        """Lápis dentro do quiz: a mudança vale só para este quiz.

        Se a pergunta é do banco, cria uma cópia exclusiva com as alterações e troca no quiz,
        na mesma posição. Se já é uma cópia exclusiva, edita ela mesma.
        """
        quiz = self.get_object()
        itens = QuizPergunta.objects.select_related("pergunta")
        item = itens.filter(quiz=quiz, pergunta_id=pergunta_id).first()
        if item is None:
            raise NotFound("Essa pergunta não está neste quiz.")

        pergunta = item.pergunta
        contexto = self.get_serializer_context()
        if pergunta.no_banco:
            # Valida sobre a original (edição parcial) e grava numa cópia.
            validador = PerguntaSerializer(pergunta, data=request.data, partial=True, context=contexto)
            validador.is_valid(raise_exception=True)
            dados = dict(validador.validated_data)
            remover = dados.pop("remover_imagem", False)
            nova_imagem = dados.pop("imagem", None)
            if remover or nova_imagem:
                dados["imagem"] = nova_imagem or ""
            copia = pergunta.copiar(**dados)
            item.pergunta = copia
            item.save(update_fields=["pergunta"])
            pergunta = copia
        else:
            serializer = PerguntaSerializer(pergunta, data=request.data, partial=True, context=contexto)
            serializer.is_valid(raise_exception=True)
            pergunta = serializer.save()

        quiz.save(update_fields=["atualizado_em"])
        return Response(PerguntaDoQuizSerializer(pergunta, context=contexto).data)
