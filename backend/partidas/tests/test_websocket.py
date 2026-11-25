import asyncio

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from rest_framework_simplejwt.tokens import AccessToken

from config.asgi import application
from partidas import jogo
from partidas.models import Partida
from perguntas.tests.test_perguntas import criar_pergunta
from quizzes.models import Quiz, QuizPergunta
from usuarios.models import Usuario

pytestmark = [pytest.mark.asyncio, pytest.mark.django_db(transaction=True)]


@database_sync_to_async
def preparar(tempo=20):
    professor = Usuario.objects.create_user(username="prof", password="x", perfil="professor")
    quiz = Quiz.objects.create(dono=professor, titulo="Sistema Solar", status="publicado")
    for ordem in (1, 2):
        pergunta = criar_pergunta(professor, texto=f"P{ordem}", tempo_limite=tempo)
        QuizPergunta.objects.create(quiz=quiz, pergunta=pergunta, ordem=ordem)
    partida = jogo.abrir_sala(quiz, 10)
    return professor, partida


async def conectar(caminho):
    comunicador = WebsocketCommunicator(application, caminho, headers=[(b"origin", b"http://localhost")])
    conectado, _ = await comunicador.connect()
    assert conectado
    return comunicador


async def proximo_estado(comunicador, **esperado):
    """Lê mensagens até chegar uma que bata com o esperado (ex.: estado="pergunta")."""
    for _ in range(10):
        mensagem = await comunicador.receive_json_from(timeout=3)
        partida = mensagem.get("partida", {})
        if all(partida.get(k) == v for k, v in esperado.items()):
            return mensagem
    raise AssertionError(f"estado {esperado} não chegou")


async def test_fluxo_pelo_websocket():
    professor, partida = await preparar()
    token = str(AccessToken.for_user(professor))
    telao = await conectar(f"/ws/partidas/{partida.pin}/?token={token}")
    inicial = await proximo_estado(telao, estado="sala")
    assert inicial["papel"] == "professor" and inicial["participantes"] == []

    ana = await database_sync_to_async(jogo.entrar)(partida.pin, "Ana")
    celular = await conectar(f"/ws/partidas/{partida.pin}/?chave={ana.chave}")
    assert (await proximo_estado(celular, estado="sala"))["voce"]["apelido"] == "Ana"
    assert [p["apelido"] for p in (await proximo_estado(telao, estado="sala"))["participantes"]] == ["Ana"]

    await telao.send_json_to({"acao": "iniciar"})
    pergunta = await proximo_estado(celular, estado="pergunta")
    await proximo_estado(telao, estado="pergunta")
    correta = (await database_sync_to_async(Partida.objects.get)(pk=partida.pk)).pergunta_atual["correta"]
    assert len(pergunta["pergunta"]["alternativas"]) == 4

    # Única participante respondeu: as respostas encerram sozinhas.
    await celular.send_json_to({"acao": "responder", "letra": correta})
    feedback = await proximo_estado(celular, estado="resultado")
    assert feedback["feedback"]["correta"] is True and feedback["voce"]["pontos"] > 900
    resultado = await proximo_estado(telao, estado="resultado")
    assert resultado["resultado"]["acertaram"] == 1

    await telao.send_json_to({"acao": "mostrar_ranking"})
    await proximo_estado(telao, estado="ranking")
    await telao.send_json_to({"acao": "encerrar_partida"})
    final = await proximo_estado(celular, estado="encerrada")
    assert final["final"]["posicao"] == 1
    await telao.disconnect()
    await celular.disconnect()


async def test_estudante_nao_pode_comandar_e_chave_invalida_e_recusada():
    _, partida = await preparar()
    ana = await database_sync_to_async(jogo.entrar)(partida.pin, "Ana")
    celular = await conectar(f"/ws/partidas/{partida.pin}/?chave={ana.chave}")
    await proximo_estado(celular, estado="sala")
    await celular.send_json_to({"acao": "iniciar"})
    assert (await celular.receive_json_from())["tipo"] == "erro"
    await celular.disconnect()

    intruso = await conectar(f"/ws/partidas/{partida.pin}/?chave=00000000-0000-0000-0000-000000000000")
    assert (await intruso.receive_json_from())["tipo"] == "erro"
    assert (await intruso.receive_output())["type"] == "websocket.close"


async def test_professor_remove_participante():
    professor, partida = await preparar()
    token = str(AccessToken.for_user(professor))
    ana = await database_sync_to_async(jogo.entrar)(partida.pin, "Ana")
    telao = await conectar(f"/ws/partidas/{partida.pin}/?token={token}")
    celular = await conectar(f"/ws/partidas/{partida.pin}/?chave={ana.chave}")
    await proximo_estado(celular, estado="sala")
    await telao.send_json_to({"acao": "remover", "participante": ana.id})
    for _ in range(5):
        mensagem = await celular.receive_json_from(timeout=3)
        if mensagem["tipo"] == "removido":
            break
    else:
        raise AssertionError("aviso de remoção não chegou")
    await telao.disconnect()


async def test_tempo_esgotado_encerra_sozinho():
    professor, partida = await preparar(tempo=5)
    token = str(AccessToken.for_user(professor))
    await database_sync_to_async(jogo.entrar)(partida.pin, "Ana")
    telao = await conectar(f"/ws/partidas/{partida.pin}/?token={token}")
    await proximo_estado(telao, estado="sala")
    # Encurta o prazo para o teste não esperar 5 segundos.
    await database_sync_to_async(jogo.iniciar)(partida)
    await database_sync_to_async(
        lambda: Partida.objects.filter(pk=partida.pk).update(
            prazo=Partida.objects.get(pk=partida.pk).pergunta_iniciada_em
        )
    )()
    # Ao (re)conectar, o telão agenda o fim da pergunta atual.
    await telao.disconnect()
    telao = await conectar(f"/ws/partidas/{partida.pin}/?token={token}")
    await asyncio.sleep(0.8)
    assert (await database_sync_to_async(Partida.objects.get)(pk=partida.pk)).estado == "resultado"
    await telao.disconnect()


@pytest.mark.parametrize(
    "origem, aceita", [(b"http://localhost:5173", True), (b"https://site-estranho.example", False)]
)
async def test_origem_da_conexao(origem, aceita):
    _, partida = await preparar()
    token = str(AccessToken.for_user(await database_sync_to_async(lambda: partida.professor)()))
    comunicador = WebsocketCommunicator(
        application, f"/ws/partidas/{partida.pin}/?token={token}", headers=[(b"origin", origem)]
    )
    conectado, _ = await comunicador.connect()
    assert conectado is aceita
    await comunicador.disconnect()
