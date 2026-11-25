"""Dashboard do professor: números do topo, jogos recentes, lista de partidas, relatório da
partida encerrada e a busca do cabeçalho do painel.

Regras confirmadas:
- "Jogos ativos" = partidas que já começaram e não terminaram; "Aguardando" = salas abertas
  esperando o professor iniciar; "Concluídos" = todas as partidas encerradas (desde sempre);
- salas canceladas (fechadas sem começar) não aparecem nas listas;
- o relatório só existe para partida encerrada (a ativa volta para o telão).
"""

from django.db.models import Count, Q
from rest_framework import serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from escola.serializers import AlunoSerializer
from perguntas.models import Pergunta
from quizzes.models import Quiz
from usuarios.models import Usuario
from usuarios.permissoes import EhProfessor

from . import jogo
from .models import Partida, Resposta

E = Partida.Estado
EM_ANDAMENTO = (E.PERGUNTA, E.RESULTADO, E.RANKING)
SITUACOES = {
    "aguardando": Q(estado=E.SALA),
    "em_andamento": Q(estado__in=EM_ANDAMENTO),
    "finalizado": Q(estado=E.ENCERRADA),
}
QUANTOS_RECENTES = 3
LIMITE_BUSCA = 5


def situacao(partida):
    if partida.estado == E.SALA:
        return "aguardando"
    if partida.estado in EM_ANDAMENTO:
        return "em_andamento"
    if partida.estado == E.ENCERRADA:
        return "finalizado"
    return "cancelada"


def partidas_do_professor(professor):
    """Partidas que aparecem nas listas (sem as canceladas), com o número de jogadores."""
    return (
        Partida.objects.filter(professor=professor)
        .exclude(estado=E.CANCELADA)
        .annotate(jogadores=Count("participantes", filter=Q(participantes__removido=False)))
        .order_by("-criada_em", "-id")
    )


class PartidaListaSerializer(serializers.ModelSerializer):
    jogadores = serializers.IntegerField(read_only=True)
    situacao = serializers.SerializerMethodField()

    class Meta:
        model = Partida
        fields = ("id", "titulo", "disciplina", "pin", "jogadores", "situacao", "criada_em", "encerrada_em")

    def get_situacao(self, partida):
        return situacao(partida)


class PaginacaoPartidas(PageNumberPagination):
    page_size = 10
    page_query_param = "pagina"


class PainelView(APIView):
    """GET /api/painel/ — números do topo e os 3 jogos mais recentes."""

    permission_classes = [EhProfessor]

    def get(self, request):
        professor = request.user
        contagem = Partida.objects.filter(professor=professor).aggregate(
            jogos_ativos=Count("id", filter=Q(estado__in=EM_ANDAMENTO)),
            aguardando=Count("id", filter=Q(estado=E.SALA)),
            concluidos=Count("id", filter=Q(estado=E.ENCERRADA)),
        )
        recentes = partidas_do_professor(professor)[:QUANTOS_RECENTES]
        return Response(
            {
                "perguntas_total": Pergunta.objects.filter(dono=professor, no_banco=True).count(),
                **contagem,
                "recentes": PartidaListaSerializer(recentes, many=True).data,
            }
        )


def relatorio(partida):
    """Pódio, ranking completo e acerto de cada pergunta de uma partida encerrada."""
    ativos = jogo.ranking(partida)
    respostas = list(Resposta.objects.filter(participante__in=ativos))
    perguntas = []
    for indice, pergunta in enumerate(partida.perguntas):
        desta = [r for r in respostas if r.indice == indice]
        acertaram = sum(1 for r in desta if r.correta)
        distribuicao = []
        for letra in pergunta["ordem"]:
            quantidade = sum(1 for r in desta if r.letra == letra)
            distribuicao.append(
                {
                    "letra": letra,
                    "texto": pergunta["alternativas"][letra],
                    "quantidade": quantidade,
                    "correta": letra == pergunta["correta"],
                }
            )
        perguntas.append(
            {
                "numero": indice + 1,
                "texto": pergunta["texto"],
                "resposta_correta": pergunta["alternativas"][pergunta["correta"]],
                "responderam": len(desta),
                "acertaram": acertaram,
                "percentual": round(acertaram * 100 / len(ativos)) if ativos else 0,
                "distribuicao": distribuicao,
            }
        )
    ranking = [
        {**linha, "com_conta": participante.usuario_id is not None}
        for linha, participante in zip(jogo._linhas_ranking(ativos), ativos, strict=True)
    ]
    for linha in ranking:
        linha.pop("variacao", None)
        linha.pop("sequencia", None)
    estatisticas = jogo._estatisticas_finais(partida, ativos)
    return {
        "id": partida.id,
        "titulo": partida.titulo,
        "disciplina": partida.disciplina,
        "pin": partida.pin,
        "iniciada_em": partida.iniciada_em,
        "encerrada_em": partida.encerrada_em,
        "total_perguntas": len(partida.perguntas),
        "estatisticas": estatisticas,
        "ranking": ranking,
        "perguntas": perguntas,
    }


class BuscaPainelView(APIView):
    """GET /api/painel/busca/?q= — busca do cabeçalho: quizzes do professor e alunos das turmas dele."""

    permission_classes = [EhProfessor]

    def get(self, request):
        termo = " ".join(request.query_params.get("q", "").split())
        if len(termo) < 2:
            return Response({"quizzes": [], "alunos": []})
        professor = request.user

        quizzes = Quiz.objects.filter(dono=professor).select_related("disciplina")
        for parte in termo.split():
            quizzes = quizzes.filter(
                Q(titulo__icontains=parte) | Q(disciplina__chave__contains=parte.casefold())
            )
        quizzes = quizzes.order_by("-atualizado_em")[:LIMITE_BUSCA]

        alunos = Usuario.objects.filter(turmas_que_participa__dono=professor, is_active=True)
        for parte in termo.split():
            alunos = alunos.filter(
                Q(username__icontains=parte)
                | Q(nome_exibicao__icontains=parte)
                | Q(first_name__icontains=parte)
                | Q(last_name__icontains=parte)
            )
        resultado_alunos = []
        for aluno in alunos.distinct().order_by("username")[:LIMITE_BUSCA]:
            turma = aluno.turmas_que_participa.filter(dono=professor).order_by("chave").first()
            resultado_alunos.append(
                {**AlunoSerializer(aluno).data, "turma": {"id": turma.id, "nome": turma.nome}}
            )

        return Response(
            {
                "quizzes": [
                    {
                        "id": quiz.id,
                        "titulo": quiz.titulo,
                        "disciplina": quiz.disciplina.nome if quiz.disciplina else "",
                        "status": quiz.status,
                    }
                    for quiz in quizzes
                ],
                "alunos": resultado_alunos,
            }
        )
