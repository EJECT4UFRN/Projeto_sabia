from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from escola.tests.auxiliares import disciplina
from partidas import jogo
from partidas.models import Participante, Partida
from perguntas.tests.test_perguntas import criar_pergunta
from quizzes.models import Quiz, QuizPergunta
from usuarios.models import Usuario


@pytest.fixture
def professor(db):
    return Usuario.objects.create_user(
        username="prof", password="Sabia#Forte2026", perfil="professor", first_name="Állex"
    )


@pytest.fixture
def cliente(professor):
    cliente = APIClient()
    cliente.force_authenticate(professor)
    return cliente


@pytest.fixture
def quiz(professor):
    quiz = Quiz.objects.create(
        dono=professor, titulo="Sistema Solar", disciplina=disciplina(professor), status="publicado"
    )
    for ordem, texto in enumerate(["Planeta vermelho?", "Maior planeta?", "Anéis visíveis?"], 1):
        pergunta = criar_pergunta(professor, texto=texto, tempo_limite=20, pontuacao_maxima=1000)
        QuizPergunta.objects.create(quiz=quiz, pergunta=pergunta, ordem=ordem)
    return quiz


@pytest.fixture
def partida(quiz):
    return jogo.abrir_sala(quiz, limite=3)


def correta(partida):
    return partida.pergunta_atual["correta"]


def errada(partida):
    return next(letra for letra in "ABCD" if letra != correta(partida))


def instante(partida, segundos):
    return partida.pergunta_iniciada_em + timedelta(seconds=segundos)


# --- abrir sala (API) -------------------------------------------------------------------------


def test_abre_sala_com_pin_e_limite(cliente, quiz):
    resposta = cliente.post("/api/partidas/", {"quiz": quiz.id, "limite_participantes": 30}, format="json")
    assert resposta.status_code == 201, resposta.data
    assert len(resposta.data["pin"]) == 6 and resposta.data["pin"].isdigit()
    assert resposta.data["limite_participantes"] == 30
    assert resposta.data["total_perguntas"] == 3
    assert resposta.data["estado"] == "sala"


def test_nao_abre_sala_de_rascunho_nem_de_outro_professor(cliente, quiz):
    quiz.status = "rascunho"
    quiz.save()
    resposta = cliente.post("/api/partidas/", {"quiz": quiz.id}, format="json")
    assert resposta.status_code == 400
    assert "Publique" in resposta.data["quiz"][0]

    outro = Usuario.objects.create_user(username="outro", password="x", perfil="professor")
    alheio = Quiz.objects.create(dono=outro, titulo="X", status="publicado")
    assert cliente.post("/api/partidas/", {"quiz": alheio.id}, format="json").status_code == 400


def test_limite_de_participantes_respeita_faixa(cliente, quiz):
    resposta = cliente.post("/api/partidas/", {"quiz": quiz.id, "limite_participantes": 0}, format="json")
    assert resposta.status_code == 400


def test_estudante_nao_abre_sala(quiz, db):
    estudante = Usuario.objects.create_user(username="aluno", password="x")
    cliente = APIClient()
    cliente.force_authenticate(estudante)
    assert cliente.post("/api/partidas/", {"quiz": quiz.id}, format="json").status_code == 403


def test_varias_salas_ao_mesmo_tempo_com_pins_diferentes(quiz):
    pins = {jogo.abrir_sala(quiz, 10).pin for _ in range(5)}
    assert len(pins) == 5


def test_embaralha_perguntas_e_respostas_quando_o_quiz_pede(quiz, monkeypatch):
    quiz.embaralhar_perguntas = quiz.embaralhar_respostas = True
    quiz.save()
    monkeypatch.setattr(jogo.random, "shuffle", lambda lista: lista.reverse())
    partida = jogo.abrir_sala(quiz, 10)
    textos = [p["texto"] for p in partida.perguntas]
    assert textos == ["Anéis visíveis?", "Maior planeta?", "Planeta vermelho?"]
    assert partida.perguntas[0]["ordem"] == ["D", "C", "B", "A"]


# --- entrar -----------------------------------------------------------------------------------


def test_convidado_entra_pela_api_e_recebe_chave(partida, db):
    resposta = APIClient().post(
        "/api/partidas/entrar/", {"pin": partida.pin, "apelido": "  Ana  "}, format="json"
    )
    assert resposta.status_code == 201, resposta.data
    assert resposta.data["apelido"] == "Ana"
    assert resposta.data["partida"]["titulo"] == "Sistema Solar"
    participante = Participante.objects.get()
    assert str(participante.chave) == resposta.data["chave"] and participante.usuario is None


def test_estudante_logado_fica_ligado_a_conta(partida, db):
    estudante = Usuario.objects.create_user(username="aluno", password="x")
    cliente = APIClient()
    cliente.force_authenticate(estudante)
    cliente.post("/api/partidas/entrar/", {"pin": partida.pin, "apelido": "Aluno"}, format="json")
    assert Participante.objects.get().usuario == estudante


def test_erros_ao_entrar(partida, db):
    cliente = APIClient()
    jogo.entrar(partida.pin, "Ana")
    assert cliente.post("/api/partidas/entrar/", {"pin": "000000", "apelido": "Bia"}).data["pin"] == [
        "Não encontramos uma sala aberta com esse PIN."
    ]
    assert (
        "já está em uso"
        in cliente.post("/api/partidas/entrar/", {"pin": partida.pin, "apelido": "ANA"}).data["apelido"][0]
    )
    assert cliente.post("/api/partidas/entrar/", {"pin": "12", "apelido": "Bia"}).data["pin"] == [
        "Digite os 6 números do PIN."
    ]


def test_sala_cheia(partida):
    for nome in ("Ana", "Bia", "Caio"):
        jogo.entrar(partida.pin, nome)
    with pytest.raises(jogo.ErroJogo, match="cheia"):
        jogo.entrar(partida.pin, "Duda")


def test_apelido_de_quem_saiu_fica_livre(partida):
    ana = jogo.entrar(partida.pin, "Ana")
    jogo.sair(ana)
    assert jogo.entrar(partida.pin, "Ana").apelido == "Ana"


def test_nao_entra_em_sala_encerrada(partida):
    jogo.entrar(partida.pin, "Ana")
    jogo.iniciar(partida)
    jogo.finalizar(Partida.objects.get(pk=partida.pk))
    with pytest.raises(jogo.ErroJogo, match="PIN"):
        jogo.entrar(partida.pin, "Bia")


# --- andamento e pontuação ----------------------------------------------------------------------


def test_nao_inicia_sem_participantes(partida):
    with pytest.raises(jogo.ErroJogo, match="estudante"):
        jogo.iniciar(partida)


def test_calculo_de_pontos_e_bonus():
    assert jogo.calcular_pontos(1000, 20, 0, 0) == (1000, 0, 1)
    assert jogo.calcular_pontos(1000, 20, 20_000, 0) == (500, 0, 1)
    assert jogo.calcular_pontos(1000, 20, 10_000, 1) == (750, 100, 2)
    assert jogo.calcular_pontos(1000, 20, 0, 9) == (1000, 500, 10)  # bônus limitado a +500
    assert jogo.calcular_pontos(1000, 20, 99_000, 0)[0] == 500  # atraso além do prazo não fica abaixo de 50%


def test_partida_completa_com_sequencia_e_ranking(partida):
    ana = jogo.entrar(partida.pin, "Ana")
    bia = jogo.entrar(partida.pin, "Bia")
    partida = jogo.iniciar(partida)

    # Pergunta 1: Ana acerta na hora, Bia erra.
    assert jogo.responder(ana, correta(partida), instante(partida, 0)) is False
    assert jogo.responder(bia, errada(partida), instante(partida, 5)) is True  # todos responderam
    jogo.encerrar_respostas(partida)

    partida = jogo.proxima(Partida.objects.get(pk=partida.pk))
    # Pergunta 2: Ana acerta de novo na metade do tempo -> 750 + bônus 100.
    jogo.responder(ana, correta(partida), instante(partida, 10))
    jogo.encerrar_respostas(partida)
    ana.refresh_from_db()
    bia.refresh_from_db()
    assert (ana.pontos, ana.sequencia, ana.acertos) == (1000 + 850, 2, 2)
    assert (bia.pontos, bia.sequencia) == (0, 0)

    partida = jogo.proxima(Partida.objects.get(pk=partida.pk))
    # Pergunta 3: Ana erra (zera a sequência), Bia não responde.
    jogo.responder(ana, errada(partida), instante(partida, 1))
    jogo.encerrar_respostas(partida)
    ana.refresh_from_db()
    assert ana.sequencia == 0 and ana.maior_sequencia == 2

    partida = jogo.proxima(Partida.objects.get(pk=partida.pk))
    assert partida.estado == Partida.Estado.ENCERRADA


def test_primeira_resposta_vale(partida):
    ana = jogo.entrar(partida.pin, "Ana")
    jogo.entrar(partida.pin, "Bia")
    partida = jogo.iniciar(partida)
    jogo.responder(ana, correta(partida), instante(partida, 1))
    with pytest.raises(jogo.ErroJogo, match="já respondeu"):
        jogo.responder(ana, errada(partida), instante(partida, 2))


def test_resposta_depois_do_prazo_e_recusada(partida):
    ana = jogo.entrar(partida.pin, "Ana")
    partida = jogo.iniciar(partida)
    with pytest.raises(jogo.ErroJogo, match="acabou"):
        jogo.responder(ana, correta(partida), partida.prazo + timedelta(seconds=2))


def test_encerrar_com_numero_antigo_nao_fecha_a_pergunta_seguinte(partida):
    jogo.entrar(partida.pin, "Ana")
    partida = jogo.iniciar(partida)
    jogo.encerrar_respostas(partida)
    partida = jogo.proxima(Partida.objects.get(pk=partida.pk))
    assert jogo.encerrar_respostas(partida, indice=0) is False
    assert Partida.objects.get(pk=partida.pk).estado == Partida.Estado.PERGUNTA


def test_quem_entra_no_meio_comeca_do_zero(partida):
    ana = jogo.entrar(partida.pin, "Ana")
    partida = jogo.iniciar(partida)
    jogo.responder(ana, correta(partida), instante(partida, 0))
    caio = jogo.entrar(partida.pin, "Caio")
    assert caio.pontos == 0
    dados = jogo.estado_participante(caio)
    assert dados["partida"]["estado"] == "pergunta" and dados["resposta"] is None


def test_removido_some_do_ranking_e_recebe_aviso(partida):
    ana = jogo.entrar(partida.pin, "Ana")
    jogo.remover(partida, ana.id)
    assert jogo.estado_participante(ana) == {"tipo": "removido"}
    assert jogo.estado_professor(partida)["participantes"] == []


def test_retrato_do_professor_e_do_estudante(partida):
    ana = jogo.entrar(partida.pin, "Ana")
    bia = jogo.entrar(partida.pin, "Bia")
    partida = jogo.iniciar(partida)

    professor = jogo.estado_professor(partida)
    assert professor["pergunta"]["numero"] == 1
    assert "correta" not in professor["pergunta"]  # durante a pergunta o telão não revela
    assert professor["respondidos"] == 0

    estudante = jogo.estado_participante(ana)
    assert estudante["pergunta"]["texto"] == "Planeta vermelho?"
    assert len(estudante["pergunta"]["alternativas"]) == 4
    assert "correta" not in estudante["pergunta"]

    jogo.responder(ana, correta(partida), instante(partida, 2))
    jogo.responder(bia, errada(partida), instante(partida, 4))
    jogo.encerrar_respostas(partida)

    professor = jogo.estado_professor(partida)
    resultado = professor["resultado"]
    assert (resultado["acertaram"], resultado["erraram"], resultado["tempo_medio"]) == (1, 1, 3.0)
    assert sum(d["quantidade"] for d in resultado["distribuicao"]) == 2
    assert professor["pergunta"]["correta"] == correta(partida)
    assert [linha["apelido"] for linha in professor["ranking"]] == ["Ana", "Bia"]

    feedback_bia = jogo.estado_participante(bia)["feedback"]
    assert feedback_bia["correta"] is False and feedback_bia["pontos"] == 0
    feedback_ana = jogo.estado_participante(ana)
    assert feedback_ana["feedback"]["correta"] is True and feedback_ana["voce"]["posicao"] == 1


def test_variacao_de_posicao(partida):
    ana = jogo.entrar(partida.pin, "Ana")
    bia = jogo.entrar(partida.pin, "Bia")
    partida = jogo.iniciar(partida)
    jogo.responder(ana, correta(partida), instante(partida, 0))
    jogo.encerrar_respostas(partida)
    partida = jogo.proxima(Partida.objects.get(pk=partida.pk))
    jogo.responder(bia, correta(partida), instante(partida, 0))
    jogo.responder(ana, errada(partida), instante(partida, 0))
    jogo.encerrar_respostas(partida)
    # Ana 1000 x Bia 1000: empate mantém a ordem de entrada, então ninguém troca.
    assert jogo.estado_participante(bia)["voce"]["variacao"] == 0
    partida = jogo.proxima(Partida.objects.get(pk=partida.pk))
    jogo.responder(bia, correta(partida), instante(partida, 0))
    jogo.encerrar_respostas(partida)
    assert jogo.estado_participante(bia)["voce"]["variacao"] == 1  # subiu uma posição
    assert jogo.estado_participante(ana)["voce"]["variacao"] == -1


def test_final_com_estatisticas_e_partidas_realizadas(cliente, partida, quiz):
    ana = jogo.entrar(partida.pin, "Ana")
    partida = jogo.iniciar(partida)
    for numero in range(3):
        if numero < 2:
            jogo.responder(ana, correta(partida), instante(partida, 0))
        jogo.encerrar_respostas(partida)
        partida = jogo.proxima(Partida.objects.get(pk=partida.pk))

    final = jogo.estado_participante(ana)["final"]
    assert (final["posicao"], final["acertos"], final["erros"], final["percentual"]) == (1, 2, 1, 67)
    estatisticas = jogo.estado_professor(partida)["estatisticas"]
    assert estatisticas["media_acertos"] == 67
    assert estatisticas["mais_dificil"] == {"numero": 3, "percentual": 0}
    assert estatisticas["maior_acerto"] == {"numero": 1, "percentual": 100}

    card = cliente.get("/api/quizzes/").data["results"][0]
    assert card["partidas_realizadas"] == 1


def test_sala_cancelada_nao_conta_como_partida(cliente, partida):
    jogo.finalizar(partida)
    assert Partida.objects.get(pk=partida.pk).estado == Partida.Estado.CANCELADA
    assert cliente.get("/api/quizzes/").data["results"][0]["partidas_realizadas"] == 0


def test_partida_sobrevive_a_exclusao_do_quiz(cliente, partida, quiz):
    ana = jogo.entrar(partida.pin, "Ana")
    jogo.iniciar(partida)
    cliente.delete(f"/api/quizzes/{quiz.id}/")
    assert jogo.estado_participante(ana)["pergunta"]["texto"] == "Planeta vermelho?"


def test_tempo_restante_vem_como_prazo_absoluto(partida):
    jogo.entrar(partida.pin, "Ana")
    partida = jogo.iniciar(partida, agora=timezone.now())
    dados = jogo.estado_professor(partida)
    assert dados["pergunta"]["prazo"] - dados["agora"] <= 20_000
