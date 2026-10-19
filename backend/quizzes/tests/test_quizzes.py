import os

import pytest
from rest_framework.test import APIClient

from escola.tests.auxiliares import disciplina
from perguntas.models import Pergunta
from perguntas.tests.test_perguntas import criar_pergunta, imagem_png
from quizzes.models import Quiz, QuizPergunta
from usuarios.models import Usuario

URL = "/api/quizzes/"


@pytest.fixture(autouse=True)
def midia_temporaria(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


@pytest.fixture
def professor(db):
    return Usuario.objects.create_user(username="prof", password="Sabia#Forte2026", perfil="professor")


@pytest.fixture
def outro_professor(db):
    return Usuario.objects.create_user(username="outra", password="Sabia#Forte2026", perfil="professor")


@pytest.fixture
def cliente(professor):
    cliente = APIClient()
    cliente.force_authenticate(professor)
    return cliente


@pytest.fixture
def perguntas(professor):
    return [criar_pergunta(professor, texto=f"Pergunta {n}") for n in range(1, 4)]


def criar_quiz(dono, perguntas=(), **extras):
    if isinstance(extras.get("disciplina"), str):
        extras["disciplina"] = disciplina(dono, extras["disciplina"])
    quiz = Quiz.objects.create(dono=dono, titulo=extras.pop("titulo", "Energia limpa"), **extras)
    for ordem, pergunta in enumerate(perguntas, 1):
        QuizPergunta.objects.create(quiz=quiz, pergunta=pergunta, ordem=ordem)
    return quiz


def editar_no_quiz(cliente, quiz, pergunta, dados):
    pergunta_id = getattr(pergunta, "id", pergunta)
    return cliente.patch(f"{URL}{quiz.id}/perguntas/{pergunta_id}/", dados, format="json")


# --- permissões ---------------------------------------------------------------------------


def test_estudante_nao_acessa_quizzes(db):
    estudante = Usuario.objects.create_user(username="aluno", password="Sabia#Forte2026")
    cliente = APIClient()
    cliente.force_authenticate(estudante)
    assert cliente.get(URL).status_code == 403


def test_professor_so_ve_os_proprios_quizzes(cliente, professor, outro_professor):
    criar_quiz(professor, titulo="Meu")
    alheio = criar_quiz(outro_professor, titulo="Alheio")
    resposta = cliente.get(URL)
    assert [q["titulo"] for q in resposta.data["results"]] == ["Meu"]
    assert cliente.get(f"{URL}{alheio.id}/").status_code == 404


# --- criar e editar -------------------------------------------------------------------------


def test_cria_rascunho_com_perguntas_na_ordem(cliente, professor, perguntas):
    ids = [perguntas[2].id, perguntas[0].id]
    ciencias = disciplina(professor)
    resposta = cliente.post(
        URL,
        {"titulo": "  Energia   solar ", "disciplina_id": ciencias.id, "perguntas_ids": ids},
        format="json",
    )
    assert resposta.status_code == 201, resposta.data
    assert resposta.data["titulo"] == "Energia solar"
    assert resposta.data["disciplina"] == "Ciências"
    assert resposta.data["disciplina_id"] == ciencias.id
    assert resposta.data["status"] == "rascunho"
    assert [p["id"] for p in resposta.data["perguntas"]] == ids
    assert resposta.data["perguntas_total"] == 2
    assert resposta.data["pode_iniciar"] is False


def test_titulo_obrigatorio(cliente):
    resposta = cliente.post(URL, {"titulo": "   "}, format="json")
    assert resposta.status_code == 400
    assert resposta.data["titulo"] == ["Dê um título para o quiz."]


def test_tempo_e_pontuacao_padrao_respeitam_limites(cliente):
    resposta = cliente.post(URL, {"titulo": "X", "tempo_padrao": 2, "pontuacao_padrao": 5000}, format="json")
    assert resposta.status_code == 400
    assert "tempo_padrao" in resposta.data and "pontuacao_padrao" in resposta.data


def test_nao_publica_sem_perguntas(cliente):
    resposta = cliente.post(URL, {"titulo": "Vazio", "status": "publicado"}, format="json")
    assert resposta.status_code == 400
    assert resposta.data["status"] == ["Adicione ao menos uma pergunta para publicar o quiz."]


def test_publicado_pode_iniciar(cliente, perguntas):
    resposta = cliente.post(
        URL, {"titulo": "Ok", "status": "publicado", "perguntas_ids": [perguntas[0].id]}, format="json"
    )
    assert resposta.status_code == 201
    assert resposta.data["pode_iniciar"] is True


def test_nao_tira_todas_as_perguntas_de_um_publicado(cliente, professor, perguntas):
    quiz = criar_quiz(professor, perguntas[:1], status="publicado")
    resposta = cliente.patch(f"{URL}{quiz.id}/", {"perguntas_ids": []}, format="json")
    assert resposta.status_code == 400
    assert "perguntas_ids" in resposta.data


def test_reordena_e_remove_perguntas(cliente, professor, perguntas):
    quiz = criar_quiz(professor, perguntas)
    ids = [perguntas[2].id, perguntas[1].id]
    resposta = cliente.patch(f"{URL}{quiz.id}/", {"perguntas_ids": ids}, format="json")
    assert resposta.status_code == 200
    assert [p["id"] for p in resposta.data["perguntas"]] == ids
    assert Pergunta.objects.filter(id=perguntas[0].id).exists()  # do banco: continua no banco


def test_recusa_pergunta_repetida_de_outro_professor_ou_inativa(cliente, professor, outro_professor):
    minha = criar_pergunta(professor)
    alheia = criar_pergunta(outro_professor)
    inativa = criar_pergunta(professor, texto="Velha", ativa=False)

    repetida = cliente.post(URL, {"titulo": "X", "perguntas_ids": [minha.id, minha.id]}, format="json")
    assert repetida.status_code == 400

    resposta = cliente.post(URL, {"titulo": "X", "perguntas_ids": [alheia.id]}, format="json")
    assert resposta.status_code == 400

    resposta = cliente.post(URL, {"titulo": "X", "perguntas_ids": [inativa.id]}, format="json")
    assert resposta.status_code == 400
    assert "inativa" in str(resposta.data["perguntas_ids"])


def test_pergunta_inativada_continua_no_quiz_em_que_ja_estava(cliente, professor):
    pergunta = criar_pergunta(professor)
    quiz = criar_quiz(professor, [pergunta])
    pergunta.ativa = False
    pergunta.save()
    dados = {"perguntas_ids": [pergunta.id], "titulo": "Novo"}
    resposta = cliente.patch(f"{URL}{quiz.id}/", dados, format="json")
    assert resposta.status_code == 200


def test_favoritar(cliente, professor):
    quiz = criar_quiz(professor)
    resposta = cliente.patch(f"{URL}{quiz.id}/", {"favorito": True}, format="json")
    assert resposta.data["favorito"] is True


# --- lista e filtros ------------------------------------------------------------------------


def test_lista_pagina_de_6_com_total_de_perguntas(cliente, professor, perguntas):
    for n in range(7):
        criar_quiz(professor, perguntas[:2], titulo=f"Quiz {n}")
    resposta = cliente.get(URL)
    assert resposta.data["count"] == 7
    assert len(resposta.data["results"]) == 6
    card = resposta.data["results"][0]
    assert card["perguntas_total"] == 2
    assert card["partidas_realizadas"] == 0
    assert cliente.get(URL, {"pagina": 2}).data["results"][0]["titulo"] == "Quiz 0"


def test_filtros(cliente, professor):
    criar_quiz(professor, titulo="Sol", disciplina="Ciências", dificuldade="facil", favorito=True)
    criar_quiz(professor, titulo="Frações", disciplina="Matemática", status="publicado")
    criar_quiz(professor, titulo="Vento", disciplina="ciências", dificuldade="dificil")

    def titulos(**filtros):
        return sorted(q["titulo"] for q in cliente.get(URL, filtros).data["results"])

    assert titulos(busca="mate") == ["Frações"]
    assert titulos(disciplina=disciplina(professor, "Ciências").id) == ["Sol", "Vento"]
    assert titulos(busca="CIÊN") == ["Sol", "Vento"]
    assert titulos(status="publicado") == ["Frações"]
    assert titulos(dificuldade="dificil") == ["Vento"]
    assert titulos(favorito="true") == ["Sol"]


def test_disciplina_de_outro_professor_nao_vale(cliente, outro_professor):
    alheia = disciplina(outro_professor, "Artes")
    resposta = cliente.post(URL, {"titulo": "Quiz", "disciplina_id": alheia.id}, format="json")
    assert resposta.status_code == 400
    assert resposta.data["disciplina_id"] == ["Essa disciplina não existe mais. Escolha outra."]


def test_excluir_disciplina_deixa_quiz_sem_disciplina(cliente, professor):
    quiz = criar_quiz(professor, disciplina="Ciências")
    assert cliente.delete(f"/api/disciplinas/{quiz.disciplina_id}/").status_code == 204
    assert cliente.get(f"{URL}{quiz.id}/").data["disciplina"] == ""


# --- duplicar -------------------------------------------------------------------------------


def test_duplicar_copia_quiz_e_perguntas(cliente, professor):
    original_pergunta = criar_pergunta(professor, imagem=imagem_png())
    quiz = criar_quiz(
        professor, [original_pergunta], status="publicado", favorito=True, disciplina="Ciências"
    )

    resposta = cliente.post(f"{URL}{quiz.id}/duplicar/")
    assert resposta.status_code == 201
    assert resposta.data["titulo"] == "Energia limpa (cópia)"
    assert resposta.data["status"] == "rascunho"
    assert resposta.data["favorito"] is False
    assert resposta.data["disciplina"] == "Ciências"

    [copia] = resposta.data["perguntas"]
    assert copia["id"] != original_pergunta.id
    assert copia["texto"] == original_pergunta.texto
    assert copia["no_banco"] is False
    assert copia["imagem"] and os.path.basename(copia["imagem"]) != ""
    # A cópia não aparece no banco de perguntas.
    ids_no_banco = [p["id"] for p in cliente.get("/api/perguntas/").data["results"]]
    assert ids_no_banco == [original_pergunta.id]


# --- lápis: editar pergunta só no quiz -----------------------------------------------------


def test_lapis_em_pergunta_do_banco_cria_copia_so_para_o_quiz(cliente, professor, perguntas):
    quiz = criar_quiz(professor, perguntas)
    outro = criar_quiz(professor, [perguntas[1]], titulo="Outro")
    alvo = perguntas[1]

    resposta = cliente.patch(f"{URL}{quiz.id}/perguntas/{alvo.id}/", {"texto": "Texto novo"}, format="json")
    assert resposta.status_code == 200, resposta.data
    assert resposta.data["texto"] == "Texto novo"
    assert resposta.data["no_banco"] is False
    copia_id = resposta.data["id"]

    alvo.refresh_from_db()
    assert alvo.texto == "Pergunta 2"  # o banco não muda
    detalhe = cliente.get(f"{URL}{quiz.id}/").data
    assert [p["id"] for p in detalhe["perguntas"]] == [perguntas[0].id, copia_id, perguntas[2].id]
    assert [p["id"] for p in cliente.get(f"{URL}{outro.id}/").data["perguntas"]] == [alvo.id]

    # Segunda edição: mexe na própria cópia, sem criar outra.
    resposta = editar_no_quiz(cliente, quiz, copia_id, {"resposta_correta": "C"})
    assert resposta.data["id"] == copia_id
    assert Pergunta.objects.filter(no_banco=False).count() == 1


def test_lapis_valida_os_dados(cliente, professor, perguntas):
    quiz = criar_quiz(professor, perguntas)
    resposta = cliente.patch(
        f"{URL}{quiz.id}/perguntas/{perguntas[0].id}/",
        {"alternativa_b": perguntas[0].alternativa_a},
        format="json",
    )
    assert resposta.status_code == 400
    assert Pergunta.objects.filter(no_banco=False).count() == 0


def test_lapis_com_pergunta_fora_do_quiz(cliente, professor, perguntas):
    quiz = criar_quiz(professor, perguntas[:1])
    resposta = cliente.patch(f"{URL}{quiz.id}/perguntas/{perguntas[2].id}/", {"texto": "x"}, format="json")
    assert resposta.status_code == 404


def test_tirar_copia_exclusiva_do_quiz_apaga_a_copia(cliente, professor, perguntas):
    quiz = criar_quiz(professor, perguntas[:2])
    copia_id = editar_no_quiz(cliente, quiz, perguntas[0], {"texto": "y"}).data["id"]
    cliente.patch(f"{URL}{quiz.id}/", {"perguntas_ids": [perguntas[1].id]}, format="json")
    assert not Pergunta.objects.filter(id=copia_id).exists()


def test_copia_exclusiva_nao_entra_em_outro_quiz(cliente, professor, perguntas):
    quiz = criar_quiz(professor, perguntas[:1])
    copia_id = editar_no_quiz(cliente, quiz, perguntas[0], {"texto": "y"}).data["id"]
    resposta = cliente.post(URL, {"titulo": "Outro", "perguntas_ids": [copia_id]}, format="json")
    assert resposta.status_code == 400


# --- excluir --------------------------------------------------------------------------------


def test_excluir_quiz_apaga_so_as_copias_exclusivas(cliente, professor, perguntas):
    quiz = criar_quiz(professor, perguntas)
    copia_id = editar_no_quiz(cliente, quiz, perguntas[0], {"texto": "y"}).data["id"]
    assert cliente.delete(f"{URL}{quiz.id}/").status_code == 204
    assert not Pergunta.objects.filter(id=copia_id).exists()
    assert Pergunta.objects.filter(no_banco=True).count() == 3


def test_pergunta_em_quiz_nao_pode_ser_excluida_do_banco(cliente, professor, perguntas):
    criar_quiz(professor, perguntas[:1])
    resposta = cliente.delete(f"/api/perguntas/{perguntas[0].id}/")
    assert resposta.status_code == 409
    assert "Desative" in resposta.data["detail"]
    assert cliente.get("/api/perguntas/").data["results"][-1]["em_quizzes"] in (0, 1)
    livre = cliente.delete(f"/api/perguntas/{perguntas[1].id}/")
    assert livre.status_code == 204


def test_banco_informa_em_quantos_quizzes_a_pergunta_esta(cliente, professor, perguntas):
    criar_quiz(professor, perguntas[:1])
    criar_quiz(professor, perguntas[:1], titulo="B")
    dados = {p["id"]: p["em_quizzes"] for p in cliente.get("/api/perguntas/").data["results"]}
    assert dados[perguntas[0].id] == 2
    assert dados[perguntas[1].id] == 0
