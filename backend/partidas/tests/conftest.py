"""Fixtures compartilhadas pelos testes de partidas (sala, painel e histórico)."""

import pytest
from rest_framework.test import APIClient

from escola.tests.auxiliares import disciplina
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
