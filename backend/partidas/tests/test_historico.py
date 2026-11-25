from datetime import timedelta

import pytest
from rest_framework.test import APIClient

from escola.tests.auxiliares import disciplina
from partidas import jogo
from partidas.models import Partida
from perguntas.tests.test_perguntas import criar_pergunta
from quizzes.models import Quiz, QuizPergunta
from usuarios.models import Usuario


@pytest.fixture
def professor(db):
    return Usuario.objects.create_user(
        username="prof", password="x", perfil="professor", nome_exibicao="Állex"
    )


@pytest.fixture
def estudante(db):
    return Usuario.objects.create_user(username="ana", password="x")


@pytest.fixture
def cliente(estudante):
    cliente = APIClient()
    cliente.force_authenticate(estudante)
    return cliente


@pytest.fixture
def quiz(professor):
    quiz = Quiz.objects.create(
        dono=professor, titulo="Sistema Solar", disciplina=disciplina(professor), status="publicado"
    )
    for ordem, texto in enumerate(["P1", "P2"], 1):
        QuizPergunta.objects.create(quiz=quiz, pergunta=criar_pergunta(professor, texto=texto), ordem=ordem)
    return quiz


def jogar(quiz, estudante, acertar=(True, True), terminar=True):
    partida = jogo.abrir_sala(quiz, 10)
    eu = jogo.entrar(partida.pin, "Ana", estudante)
    outro = jogo.entrar(partida.pin, "Bia")
    partida = jogo.iniciar(partida)
    for numero, acerto in enumerate(acertar):
        letra = (
            partida.pergunta_atual["correta"]
            if acerto
            else next(x for x in "ABCD" if x != partida.pergunta_atual["correta"])
        )
        jogo.responder(eu, letra, partida.pergunta_iniciada_em + timedelta(seconds=1))
        jogo.responder(outro, partida.pergunta_atual["correta"], partida.pergunta_iniciada_em)
        jogo.encerrar_respostas(partida)
        if terminar or numero < len(acertar) - 1:
            partida = jogo.proxima(Partida.objects.get(pk=partida.pk))
    eu.refresh_from_db()
    return partida, eu


def test_historico_com_resumo_e_paginacao(cliente, quiz, estudante):
    _, primeira = jogar(quiz, estudante, (True, True))
    _, segunda = jogar(quiz, estudante, (True, False))
    resposta = cliente.get("/api/historico/")
    assert resposta.status_code == 200
    assert resposta.data["resumo"] == {
        "partidas": 2,
        "recorde": primeira.pontos,
        "pontos_totais": primeira.pontos + segunda.pontos,
    }
    item = resposta.data["results"][0]
    assert item["id"] == segunda.id and item["estado"] == "encerrada"
    assert item["titulo"] == "Sistema Solar" and item["participantes"] == 2


def test_fica_fora_convidado_cancelada_e_quem_saiu(cliente, quiz, estudante):
    cancelada = jogo.abrir_sala(quiz, 10)
    jogo.entrar(cancelada.pin, "Ana", estudante)
    jogo.finalizar(cancelada)
    saiu = jogo.abrir_sala(quiz, 10)
    jogo.sair(jogo.entrar(saiu.pin, "Ana", estudante))
    convidado = jogo.abrir_sala(quiz, 10)
    jogo.entrar(convidado.pin, "Ana")
    resposta = cliente.get("/api/historico/")
    assert resposta.data["resumo"]["partidas"] == 0
    assert resposta.data["results"] == []


def test_partida_em_curso_pode_ser_retomada(cliente, quiz, estudante):
    partida, eu = jogar(quiz, estudante, (True, True), terminar=False)
    item = cliente.get("/api/historico/").data["results"][0]
    assert item["estado"] == "em_curso"
    retomar = cliente.post(f"/api/historico/{eu.id}/retomar/")
    assert retomar.status_code == 200
    assert retomar.data == {
        "pin": partida.pin,
        "chave": str(eu.chave),
        "apelido": "Ana",
        "titulo": "Sistema Solar",
    }
    assert cliente.get(f"/api/historico/{eu.id}/").status_code == 409


def test_resumo_da_partida_encerrada(cliente, quiz, estudante):
    _, eu = jogar(quiz, estudante, (True, False))
    resposta = cliente.get(f"/api/historico/{eu.id}/")
    assert resposta.status_code == 200
    dados = resposta.data
    assert (dados["acertos"], dados["erros"], dados["percentual"], dados["posicao"]) == (1, 1, 50, 2)
    assert dados["professor"] == "Állex"
    assert [p["acertou"] for p in dados["perguntas"]] == [True, False]
    assert dados["perguntas"][1]["sua_resposta"] != dados["perguntas"][1]["resposta_correta"]
    assert cliente.post(f"/api/historico/{eu.id}/retomar/").status_code == 409


def test_nao_ve_participacao_de_outra_pessoa(quiz, estudante, db):
    _, eu = jogar(quiz, estudante)
    intrusa = Usuario.objects.create_user(username="bia", password="x")
    cliente = APIClient()
    cliente.force_authenticate(intrusa)
    assert cliente.get(f"/api/historico/{eu.id}/").status_code == 404
    assert cliente.post(f"/api/historico/{eu.id}/retomar/").status_code == 404
