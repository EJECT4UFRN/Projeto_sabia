import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from usuarios.models import Usuario


@pytest.mark.django_db
def test_endpoint_de_saude_responde_sem_autenticacao():
    resposta = APIClient().get(reverse("saude"))

    assert resposta.status_code == 200
    assert resposta.json() == {"status": "ok"}


@pytest.mark.django_db
def test_usuario_novo_e_estudante_por_padrao():
    usuario = Usuario.objects.create_user(username="allex", password="senha-forte-123")

    assert usuario.perfil == Usuario.Perfil.ESTUDANTE
    assert not usuario.eh_professor
    assert usuario.cor_avatar == Usuario.CorAvatar.LARANJA_SINERGY


@pytest.mark.django_db
def test_email_e_opcional():
    usuario = Usuario.objects.create_user(username="sem-email", password="senha-forte-123")

    assert usuario.email == ""


@pytest.mark.django_db
@pytest.mark.parametrize(
    "dados, esperado",
    [
        ({"username": "x", "first_name": "Állex", "last_name": "Thierry"}, "ÁT"),
        ({"username": "allexthierry"}, "AL"),
    ],
)
def test_iniciais_do_avatar(dados, esperado):
    usuario = Usuario.objects.create_user(password="senha-forte-123", **dados)

    assert usuario.iniciais == esperado
