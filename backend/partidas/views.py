from django.db.models import Q
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from usuarios.permissoes import EhProfessor

from . import jogo
from .models import Partida
from .painel import SITUACOES, PaginacaoPartidas, PartidaListaSerializer, partidas_do_professor, relatorio
from .serializers import AbrirSalaSerializer, EntrarSerializer, PartidaSerializer


class PartidaViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Salas do professor. A partida em si acontece pelo WebSocket `/ws/partidas/<pin>/`.

    Lista ("Minhas partidas"): sem as canceladas, 10 por página. Filtros: ?situacao=
    aguardando|em_andamento|finalizado, ?busca= (título ou PIN), ?pagina=N.
    """

    serializer_class = PartidaSerializer
    permission_classes = [EhProfessor]
    pagination_class = PaginacaoPartidas

    def get_serializer_class(self):
        return PartidaListaSerializer if self.action == "list" else PartidaSerializer

    def get_queryset(self):
        if self.action != "list":
            return Partida.objects.filter(professor=self.request.user)
        partidas = partidas_do_professor(self.request.user)
        filtros = self.request.query_params
        if filtros.get("situacao") in SITUACOES:
            partidas = partidas.filter(SITUACOES[filtros["situacao"]])
        busca = " ".join(filtros.get("busca", "").split())
        if busca:
            digitos = "".join(ch for ch in busca if ch.isdigit())
            filtro = Q(titulo__icontains=busca)
            if len(digitos) >= 3 and len(digitos) == len(busca.replace(" ", "")):
                filtro |= Q(pin__contains=digitos)
            partidas = partidas.filter(filtro)
        return partidas

    @action(detail=True)
    def relatorio(self, request, pk=None):
        """Relatório da partida encerrada: pódio, ranking e acerto por pergunta."""
        partida = self.get_object()
        if partida.estado != Partida.Estado.ENCERRADA:
            return Response(
                {"detail": "O relatório fica pronto quando a partida termina."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(relatorio(partida))

    def create(self, request):
        entrada = AbrirSalaSerializer(data=request.data, context={"request": request})
        entrada.is_valid(raise_exception=True)
        partida = jogo.abrir_sala(
            entrada.validated_data["quiz"], entrada.validated_data["limite_participantes"], request
        )
        return Response(PartidaSerializer(partida).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def entrar(self, request):
        """Estudante (logado ou convidado) entra na sala pelo PIN e recebe a chave para o WebSocket."""
        entrada = EntrarSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        try:
            participante = jogo.entrar(
                entrada.validated_data["pin"], entrada.validated_data["apelido"], request.user
            )
        except jogo.ErroJogo as erro:
            return Response({erro.campo or "detail": [erro.mensagem]}, status=status.HTTP_400_BAD_REQUEST)
        partida = participante.partida
        return Response(
            {
                "chave": str(participante.chave),
                "apelido": participante.apelido,
                "partida": {"pin": partida.pin, "titulo": partida.titulo},
            },
            status=status.HTTP_201_CREATED,
        )
