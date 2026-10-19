from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from usuarios.permissoes import EhProfessor

from . import jogo
from .models import Partida
from .serializers import AbrirSalaSerializer, EntrarSerializer, PartidaSerializer


class PartidaViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Salas do professor. A partida em si acontece pelo WebSocket `/ws/partidas/<pin>/`."""

    serializer_class = PartidaSerializer
    permission_classes = [EhProfessor]

    def get_queryset(self):
        return Partida.objects.filter(professor=self.request.user)

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
