import pytest
from rest_framework.test import APIClient

from escola.models import Turma
from partidas import jogo
from partidas.models import Partida
from partidas.tests.test_partidas import correta, errada, instante
from perguntas.tests.test_perguntas import criar_pergunta
from quizzes.models import Quiz
from usuarios.models import Usuario


def jogar_ate_o_fim(quiz_da_partida, alunos):
    """Abre a sala, faz os alunos responderem (o 1º acerta tudo, os outros erram a 1ª) e encerra."""
    partida = jogo.abrir_sala(quiz_da_partida, limite=10)
    participantes = [jogo.entrar(partida.pin, apelido, usuario) for apelido, usuario in alunos]
    jogo.iniciar(partida)
    for indice in range(len(partida.perguntas)):
        partida.refresh_from_db()
        for posicao, participante in enumerate(participantes):
            letra = correta(partida) if posicao == 0 or indice > 0 else errada(partida)
            jogo.responder(participante, letra, instante(partida, 2 + posicao))
        jogo.encerrar_respostas(partida)
        if indice < len(partida.perguntas) - 1:
            jogo.proxima(partida)
    jogo.finalizar(partida)
    partida.refresh_from_db()
    return partida


def test_numeros_e_recentes(cliente, professor, quiz):
    criar_pergunta(professor, texto="Extra")
    encerrada = jogar_ate_o_fim(quiz, [("Ana", None), ("Beto", None)])
    em_andamento = jogo.abrir_sala(quiz, limite=5)
    jogo.entrar(em_andamento.pin, "Caio")
    jogo.iniciar(em_andamento)
    aguardando = jogo.abrir_sala(quiz, limite=5)
    cancelada = jogo.abrir_sala(quiz, limite=5)
    jogo.finalizar(cancelada)

    dados = cliente.get("/api/painel/").data
    assert dados["perguntas_total"] == 4
    assert (dados["jogos_ativos"], dados["aguardando"], dados["concluidos"]) == (1, 1, 1)
    recentes = dados["recentes"]
    assert [p["id"] for p in recentes] == [aguardando.id, em_andamento.id, encerrada.id]
    assert [p["situacao"] for p in recentes] == ["aguardando", "em_andamento", "finalizado"]
    assert recentes[2]["jogadores"] == 2


def test_lista_de_partidas_com_filtros(cliente, quiz):
    encerrada = jogar_ate_o_fim(quiz, [("Ana", None)])
    aguardando = jogo.abrir_sala(quiz, limite=5)

    def ids(**filtros):
        return [p["id"] for p in cliente.get("/api/partidas/", filtros).data["results"]]

    assert ids() == [aguardando.id, encerrada.id]
    assert ids(situacao="finalizado") == [encerrada.id]
    assert ids(situacao="aguardando") == [aguardando.id]
    assert ids(busca=encerrada.pin[:4]) == [encerrada.id]
    assert ids(busca="sistema") == [aguardando.id, encerrada.id]
    assert ids(busca="nada") == []


def test_relatorio_da_partida_encerrada(cliente, professor, quiz):
    aluno = Usuario.objects.create_user(username="ana", password="x")
    partida = jogar_ate_o_fim(quiz, [("Ana", aluno), ("Beto", None)])

    dados = cliente.get(f"/api/partidas/{partida.id}/relatorio/").data
    assert dados["titulo"] == "Sistema Solar"
    assert dados["total_perguntas"] == 3
    assert [linha["apelido"] for linha in dados["ranking"]] == ["Ana", "Beto"]
    assert dados["ranking"][0]["acertos"] == 3
    assert [linha["com_conta"] for linha in dados["ranking"]] == [True, False]
    primeira = dados["perguntas"][0]
    assert (primeira["acertaram"], primeira["percentual"], primeira["responderam"]) == (1, 50, 2)
    assert sum(item["quantidade"] for item in primeira["distribuicao"]) == 2
    assert sum(1 for item in primeira["distribuicao"] if item["correta"]) == 1
    assert dados["perguntas"][1]["percentual"] == 100
    assert dados["estatisticas"]["participantes"] == 2


def test_relatorio_so_de_partida_encerrada_e_do_proprio_professor(cliente, quiz):
    ativa = jogo.abrir_sala(quiz, limite=5)
    assert cliente.get(f"/api/partidas/{ativa.id}/relatorio/").status_code == 409

    outro = Usuario.objects.create_user(username="outro", password="x", perfil="professor")
    alheia = Partida.objects.create(professor=outro, titulo="X", pin="999999", estado="encerrada")
    assert cliente.get(f"/api/partidas/{alheia.id}/relatorio/").status_code == 404


def test_busca_do_cabecalho(cliente, professor):
    Quiz.objects.create(dono=professor, titulo="Energia Solar — Etapa 1")
    outro = Usuario.objects.create_user(username="outro", password="x", perfil="professor")
    Quiz.objects.create(dono=outro, titulo="Energia alheia")
    turma = Turma.objects.create(dono=professor, nome="8º Ano A")
    ana = Usuario.objects.create_user(
        username="ana.lima", password="x", first_name="Ana", last_name="Energia"
    )
    turma.alunos.add(ana)
    Usuario.objects.create_user(username="ana.fora", password="x", first_name="Ana")  # fora das turmas

    dados = cliente.get("/api/painel/busca/", {"q": "energia"}).data
    assert [q["titulo"] for q in dados["quizzes"]] == ["Energia Solar — Etapa 1"]
    assert [a["username"] for a in dados["alunos"]] == ["ana.lima"]
    assert dados["alunos"][0]["turma"] == {"id": turma.id, "nome": "8º Ano A"}
    assert cliente.get("/api/painel/busca/", {"q": "a"}).data == {"quizzes": [], "alunos": []}


@pytest.mark.django_db
def test_estudante_nao_ve_o_painel():
    estudante = Usuario.objects.create_user(username="aluno", password="x")
    do_estudante = APIClient()
    do_estudante.force_authenticate(estudante)
    assert do_estudante.get("/api/painel/").status_code == 403
    assert do_estudante.get("/api/partidas/").status_code == 403
