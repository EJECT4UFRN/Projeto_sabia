from django.db.models import Count, ProtectedError, Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from usuarios.models import Usuario
from usuarios.permissoes import EhProfessor

from .models import Turma, gerar_codigo_turma
from .serializers import (
    AlunoSerializer,
    DisciplinaSerializer,
    MinhaTurmaSerializer,
    TurmaDetalheSerializer,
    TurmaSerializer,
)

LIMITE_BUSCA_ALUNOS = 8


class DisciplinaViewSet(viewsets.ModelViewSet):
    """Disciplinas do professor logado (usadas nos quizzes e nos materiais)."""

    permission_classes = [EhProfessor]
    serializer_class = DisciplinaSerializer
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        return self.request.user.disciplinas.all()

    def destroy(self, request, *args, **kwargs):
        disciplina = self.get_object()
        try:
            disciplina.delete()
        except ProtectedError:
            return Response(
                {"detail": "Esta disciplina tem materiais. Mude a disciplina deles antes de excluir."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class TurmaViewSet(viewsets.ModelViewSet):
    """Turmas do professor logado e os estudantes de cada uma."""

    permission_classes = [EhProfessor]
    pagination_class = None
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        return self.request.user.turmas.annotate(alunos_total=Count("alunos", distinct=True))

    def get_serializer_class(self):
        return TurmaSerializer if self.action == "list" else TurmaDetalheSerializer

    def _detalhe(self, turma):
        turma = self.get_queryset().get(pk=turma.pk)
        return Response(TurmaDetalheSerializer(turma, context=self.get_serializer_context()).data)

    @action(detail=True, methods=["post"])
    def alunos(self, request, pk=None):
        """Adiciona um estudante: {"aluno_id": 12}."""
        turma = self.get_object()
        aluno_id = str(request.data.get("aluno_id") or "")
        aluno = None
        if aluno_id.isdigit():
            aluno = Usuario.objects.filter(
                pk=aluno_id, perfil=Usuario.Perfil.ESTUDANTE, is_active=True
            ).first()
        if aluno is None:
            raise ValidationError({"aluno_id": ["Estudante não encontrado."]})
        turma.alunos.add(aluno)
        return self._detalhe(turma)

    @action(detail=True, methods=["delete"], url_path=r"alunos/(?P<aluno_id>\d+)")
    def remover_aluno(self, request, pk=None, aluno_id=None):
        turma = self.get_object()
        turma.alunos.remove(aluno_id)
        return self._detalhe(turma)

    @action(detail=True, methods=["post"])
    def novo_codigo(self, request, pk=None):
        """Troca o código da turma (o antigo deixa de funcionar)."""
        turma = self.get_object()
        turma.codigo = gerar_codigo_turma()
        turma.save(update_fields=["codigo"])
        return self._detalhe(turma)


class BuscaAlunosView(APIView):
    """Busca de estudantes para o professor adicionar à turma: ?busca= (nome, usuário ou e-mail)."""

    permission_classes = [EhProfessor]

    def get(self, request):
        busca = " ".join(request.query_params.get("busca", "").split())
        if len(busca) < 2:
            return Response([])
        alunos = Usuario.objects.filter(perfil=Usuario.Perfil.ESTUDANTE, is_active=True)
        for parte in busca.split():
            alunos = alunos.filter(
                Q(username__icontains=parte)
                | Q(nome_exibicao__icontains=parte)
                | Q(first_name__icontains=parte)
                | Q(last_name__icontains=parte)
                | Q(email__icontains=parte)
            )
        alunos = alunos.order_by("username")[:LIMITE_BUSCA_ALUNOS]
        return Response(AlunoSerializer(alunos, many=True).data)


class MinhasTurmasViewSet(mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    """Turmas do estudante logado: listar, entrar pelo código e sair."""

    serializer_class = MinhaTurmaSerializer
    pagination_class = None

    def get_queryset(self):
        return self.request.user.turmas_que_participa.select_related("dono").order_by("chave")

    def perform_destroy(self, turma):
        turma.alunos.remove(self.request.user)

    @action(detail=False, methods=["post"])
    def entrar(self, request):
        codigo = "".join(str(request.data.get("codigo", "")).split()).upper()
        if not codigo:
            raise ValidationError({"codigo": ["Digite o código da turma."]})
        if request.user.eh_professor:
            raise ValidationError({"codigo": ["Só estudantes entram em turmas."]})
        turma = Turma.objects.select_related("dono").filter(codigo=codigo).first()
        if turma is None:
            raise ValidationError({"codigo": ["Código não encontrado. Confira com seu professor."]})
        if turma.alunos.filter(pk=request.user.pk).exists():
            raise ValidationError({"codigo": [f"Você já está na turma {turma.nome}."]})
        turma.alunos.add(request.user)
        return Response(MinhaTurmaSerializer(turma).data, status=status.HTTP_201_CREATED)
