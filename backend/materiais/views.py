from django.db import IntegrityError, transaction
from django.db.models import Case, Count, IntegerField, Q, Value, When
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from escola.serializers import AlunoSerializer
from partidas.models import Participante
from usuarios.permissoes import EhProfessor

from .models import Conclusao, Material, Visualizacao
from .serializers import MaterialEstudoSerializer, MaterialSerializer


class PaginacaoMateriais(PageNumberPagination):
    page_size = 6
    page_query_param = "pagina"
    page_size_query_param = "por_pagina"
    max_page_size = 50


def _busca(materiais, texto):
    texto = " ".join((texto or "").split())
    if not texto:
        return materiais
    for parte in texto.split():
        chave = parte.casefold()
        materiais = materiais.filter(
            Q(titulo__icontains=parte) | Q(descricao__icontains=parte) | Q(disciplina__chave__contains=chave)
        )
    return materiais


class MaterialViewSet(viewsets.ModelViewSet):
    """Materiais de estudo do professor logado.

    Filtros: ?busca=, ?disciplina=<id>, ?tipo=video|documento|artigo, ?status=rascunho|publicado,
    ?pagina=N (6 por página). /resumo/ traz os números dos cards do topo.
    """

    permission_classes = [EhProfessor]
    serializer_class = MaterialSerializer
    pagination_class = PaginacaoMateriais
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "post", "patch", "delete"]

    def get_queryset(self):
        materiais = (
            Material.objects.filter(dono=self.request.user)
            .select_related("disciplina")
            .prefetch_related("turmas")
        )
        if self.action != "list":
            return materiais

        materiais = materiais.annotate(
            visualizacoes_total=Count("visualizacoes", distinct=True),
            conclusoes_total=Count("conclusoes", distinct=True),
        ).order_by("-criado_em", "-id")
        filtros = self.request.query_params
        materiais = _busca(materiais, filtros.get("busca"))
        if filtros.get("disciplina", "").isdigit():
            materiais = materiais.filter(disciplina_id=filtros["disciplina"])
        if filtros.get("tipo") in Material.Tipo.values:
            materiais = materiais.filter(tipo=filtros["tipo"])
        if filtros.get("status") in Material.Status.values:
            materiais = materiais.filter(status=filtros["status"])
        return materiais

    @transaction.atomic
    def perform_destroy(self, material):
        material.apagar_arquivos()
        material.delete()

    @action(detail=True)
    def conclusoes(self, request, pk=None):
        """Estudantes que marcaram o material como concluído (do mais recente para o mais antigo)."""
        material = self.get_object()
        conclusoes = material.conclusoes.select_related("usuario").order_by("-criada_em")
        return Response(
            [
                {**AlunoSerializer(conclusao.usuario).data, "concluido_em": conclusao.criada_em}
                for conclusao in conclusoes
            ]
        )

    @action(detail=False)
    def resumo(self, request):
        contagem = Material.objects.filter(dono=request.user).aggregate(
            publicados=Count("id", filter=Q(status=Material.Status.PUBLICADO)),
            rascunhos=Count("id", filter=Q(status=Material.Status.RASCUNHO)),
            videos=Count("id", filter=Q(tipo=Material.Tipo.VIDEO)),
            documentos=Count("id", filter=Q(tipo=Material.Tipo.DOCUMENTO)),
            artigos=Count("id", filter=Q(tipo=Material.Tipo.ARTIGO)),
        )
        return Response(contagem)


def materiais_visiveis(usuario, com_rascunhos_proprios=False):
    """Publicados e liberados para quem está vendo: os públicos e os das turmas do estudante.

    O professor também vê os próprios (inclusive rascunhos, quando abre a pré-visualização)."""
    liberados = Q(publico=True)
    if usuario.is_authenticated:
        liberados |= Q(turmas__alunos=usuario) | Q(dono=usuario)
    visiveis = Q(status=Material.Status.PUBLICADO) & liberados
    if com_rascunhos_proprios and usuario.is_authenticated:
        visiveis |= Q(dono=usuario)
    ids = Material.objects.filter(visiveis).values("id")
    return Material.objects.filter(id__in=ids).select_related("disciplina", "dono")


def disciplinas_jogadas(usuario):
    """Disciplinas (em minúsculas) das partidas que o estudante jogou, para os recomendados."""
    if not usuario.is_authenticated:
        return set()
    nomes = (
        Participante.objects.filter(usuario=usuario, removido=False)
        .exclude(partida__disciplina="")
        .values_list("partida__disciplina", flat=True)
        .distinct()
    )
    return {" ".join(nome.split()).casefold() for nome in nomes}


class EstudoViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """ "Continue aprendendo": aberto a qualquer pessoa (visitante vê só os públicos).

    Lista: ?busca=, ?tipo=video|documento|artigo, ?pagina=N. Primeiro os materiais das disciplinas
    que o estudante já jogou, depois os mais novos. Abrir um material conta 1 visualização por
    estudante. /concluir/ (POST marca, DELETE desmarca) quando o professor permite.
    """

    serializer_class = MaterialEstudoSerializer
    pagination_class = PaginacaoMateriais
    permission_classes = [AllowAny]

    def get_permissions(self):
        if self.action == "concluir":
            return [IsAuthenticated()]
        return super().get_permissions()

    def get_queryset(self):
        usuario = self.request.user
        materiais = materiais_visiveis(usuario, com_rascunhos_proprios=self.action == "retrieve")
        if self.action != "list":
            return materiais
        filtros = self.request.query_params
        materiais = _busca(materiais, filtros.get("busca"))
        if filtros.get("tipo") in Material.Tipo.values:
            materiais = materiais.filter(tipo=filtros["tipo"])
        chaves = disciplinas_jogadas(usuario)
        return materiais.annotate(
            recomendado=Case(
                When(disciplina__chave__in=chaves, then=Value(1)),
                default=Value(0),
                output_field=IntegerField(),
            )
        ).order_by("-recomendado", "-criado_em", "-id")

    def get_serializer_context(self):
        contexto = super().get_serializer_context()
        usuario = self.request.user
        if self.action == "list":
            contexto["concluidos"] = (
                set(Conclusao.objects.filter(usuario=usuario).values_list("material_id", flat=True))
                if usuario.is_authenticated
                else set()
            )
        return contexto

    def retrieve(self, request, *args, **kwargs):
        material = self.get_object()
        usuario = request.user
        if usuario.is_authenticated and usuario.pk != material.dono_id:
            try:
                with transaction.atomic():
                    Visualizacao.objects.get_or_create(material=material, usuario=usuario)
            except IntegrityError:
                pass  # duas aberturas ao mesmo tempo: a outra já contou
        return Response(self.get_serializer(material).data)

    @action(detail=True, methods=["post", "delete"])
    def concluir(self, request, pk=None):
        material = self.get_object()
        if not material.permitir_concluir:
            raise PermissionDenied("Este material não pode ser marcado como concluído.")
        if request.method == "DELETE":
            Conclusao.objects.filter(material=material, usuario=request.user).delete()
        else:
            Conclusao.objects.get_or_create(material=material, usuario=request.user)
        dados = self.get_serializer(material).data
        return Response(dados, status=status.HTTP_200_OK)
