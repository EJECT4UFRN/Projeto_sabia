"""Histórico do estudante logado: as partidas em que entrou com a conta.

Regras confirmadas:
- entram só as partidas jogadas com a conta (convidado não tem histórico); ficam de fora as
  salas canceladas e as participações de quem saiu ou foi removido da sala;
- "Partidas" conta todas as que aparecem, "Recorde" é a maior pontuação numa partida e
  "Pts totais" é a soma;
- partida em curso pode ser retomada (de qualquer aparelho); partida encerrada abre um resumo.
"""

from django.db.models import Max, Sum
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import jogo
from .models import Participante, Partida

POR_PAGINA = 10


def participacoes(usuario):
    return (
        Participante.objects.filter(usuario=usuario, removido=False)
        .exclude(partida__estado=Partida.Estado.CANCELADA)
        .select_related("partida")
    )


def _posicao(participante):
    lista = jogo.ranking(participante.partida)
    return next((i for i, p in enumerate(lista, 1) if p.id == participante.id), None), len(lista)


def _item(participante):
    partida = participante.partida
    encerrada = partida.estado == Partida.Estado.ENCERRADA
    dados = {
        "id": participante.id,
        "titulo": partida.titulo,
        "disciplina": partida.disciplina,
        "pin": partida.pin,
        "data": (partida.iniciada_em or partida.criada_em).isoformat(),
        "pontos": participante.pontos,
        "estado": "encerrada" if encerrada else "em_curso",
    }
    if encerrada:
        dados["posicao"], dados["participantes"] = _posicao(participante)
    return dados


class Paginacao(PageNumberPagination):
    page_size = POR_PAGINA
    page_query_param = "pagina"


def _buscar(request, participacao_id):
    participante = participacoes(request.user).filter(pk=participacao_id).first()
    if participante is None:
        raise NotFound("Partida não encontrada no seu histórico.")
    return participante


class HistoricoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        todas = participacoes(request.user)
        numeros = todas.aggregate(recorde=Max("pontos"), total=Sum("pontos"))
        paginador = Paginacao()
        pagina = paginador.paginate_queryset(todas.order_by("-partida__criada_em", "-id"), request, view=self)
        resposta = paginador.get_paginated_response([_item(p) for p in pagina])
        resposta.data["resumo"] = {
            "partidas": todas.count(),
            "recorde": numeros["recorde"] or 0,
            "pontos_totais": numeros["total"] or 0,
        }
        return resposta


class ResumoPartidaView(APIView):
    """Resumo de uma partida encerrada: posição, números e cada pergunta com a resposta dada."""

    permission_classes = [IsAuthenticated]

    def get(self, request, participacao_id):
        participante = _buscar(request, participacao_id)
        partida = participante.partida
        if partida.estado != Partida.Estado.ENCERRADA:
            return Response(
                {"detail": "Esta partida ainda está em curso.", "em_curso": True},
                status=status.HTTP_409_CONFLICT,
            )
        respostas = {r.indice: r for r in participante.respostas.all()}
        perguntas = []
        for indice, pergunta in enumerate(partida.perguntas):
            resposta = respostas.get(indice)
            perguntas.append(
                {
                    "numero": indice + 1,
                    "texto": pergunta["texto"],
                    "resposta_correta": pergunta["alternativas"][pergunta["correta"]],
                    "sua_resposta": pergunta["alternativas"][resposta.letra] if resposta else None,
                    "acertou": bool(resposta and resposta.correta),
                    "pontos": (resposta.pontos + resposta.bonus) if resposta else 0,
                    "tempo": round(resposta.tempo_ms / 1000, 1) if resposta else None,
                }
            )
        total = len(partida.perguntas)
        dados = _item(participante)
        dados.update(
            {
                "professor": partida.professor.nome,
                "acertos": participante.acertos,
                "erros": total - participante.acertos,
                "percentual": round(participante.acertos * 100 / total) if total else 0,
                "maior_sequencia": participante.maior_sequencia,
                "total_perguntas": total,
                "perguntas": perguntas,
            }
        )
        return Response(dados)


class RetomarPartidaView(APIView):
    """Devolve a chave da participação para voltar a uma partida em curso (de qualquer aparelho)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, participacao_id):
        participante = _buscar(request, participacao_id)
        partida = participante.partida
        if not partida.ativa:
            return Response({"detail": "Esta partida já terminou."}, status=status.HTTP_409_CONFLICT)
        return Response(
            {
                "pin": partida.pin,
                "chave": str(participante.chave),
                "apelido": participante.apelido,
                "titulo": partida.titulo,
            }
        )
