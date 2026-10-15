import re

import pytest
from django.core import mail
from django.urls import reverse
from rest_framework.test import APIClient

from usuarios.models import Usuario

SENHA = "Sabia#Forte2026"


@pytest.fixture
def cliente():
    return APIClient()


@pytest.fixture
def estudante():
    return Usuario.objects.create_user(username="AllexThierry", email="allex@exemplo.com", password=SENHA)


def cadastrar(cliente, **dados):
    corpo = {"username": "novo_aluno", "senha": SENHA, "confirmar_senha": SENHA, **dados}
    return cliente.post(reverse("cadastro"), corpo, format="json")


# ---------------------------------------------------------------- cadastro


@pytest.mark.django_db
def test_cadastro_de_estudante_cria_conta_e_devolve_tokens(cliente):
    resposta = cadastrar(cliente, email="Novo@Exemplo.com")

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["access"] and corpo["refresh"]
    assert corpo["usuario"]["perfil"] == "estudante"
    assert corpo["usuario"]["email"] == "novo@exemplo.com"
    assert Usuario.objects.get(username="novo_aluno").check_password(SENHA)


@pytest.mark.django_db
def test_cadastro_de_professor(cliente):
    resposta = cadastrar(cliente, perfil="professor")

    assert resposta.status_code == 201
    assert resposta.json()["usuario"]["perfil"] == "professor"


@pytest.mark.django_db
def test_cadastro_sem_email_e_permitido(cliente):
    resposta = cadastrar(cliente, email="")

    assert resposta.status_code == 201
    assert Usuario.objects.get(username="novo_aluno").email == ""


@pytest.mark.django_db
def test_cadastro_nao_aceita_perfil_inexistente(cliente):
    resposta = cadastrar(cliente, perfil="superadmin")

    assert resposta.status_code == 400
    assert "perfil" in resposta.json()


@pytest.mark.django_db
def test_cadastro_recusa_senhas_diferentes(cliente):
    resposta = cadastrar(cliente, confirmar_senha="OutraSenha#2026")

    assert resposta.status_code == 400
    assert resposta.json()["confirmar_senha"] == ["As senhas não coincidem."]


@pytest.mark.django_db
def test_cadastro_recusa_senha_fraca(cliente):
    resposta = cadastrar(cliente, senha="123", confirmar_senha="123")

    assert resposta.status_code == 400
    assert "senha" in resposta.json()


@pytest.mark.django_db
def test_cadastro_recusa_usuario_repetido_sem_diferenciar_maiusculas(cliente, estudante):
    resposta = cadastrar(cliente, username="allexthierry")

    assert resposta.status_code == 400
    assert resposta.json()["username"] == ["Este nome de usuário já está em uso."]


@pytest.mark.django_db
def test_cadastro_recusa_email_repetido(cliente, estudante):
    resposta = cadastrar(cliente, email="ALLEX@exemplo.com")

    assert resposta.status_code == 400
    assert resposta.json()["email"] == ["Já existe uma conta com este e-mail."]


# ---------------------------------------------------------------- entrar / sair


@pytest.mark.django_db
@pytest.mark.parametrize("login", ["AllexThierry", "allexthierry", "allex@exemplo.com", "ALLEX@EXEMPLO.COM"])
def test_entrar_com_usuario_ou_email(cliente, estudante, login):
    resposta = cliente.post(reverse("entrar"), {"login": login, "senha": SENHA}, format="json")

    assert resposta.status_code == 200
    assert resposta.json()["usuario"]["username"] == "AllexThierry"


@pytest.mark.django_db
@pytest.mark.parametrize("login, senha", [("AllexThierry", "errada"), ("ninguem", SENHA)])
def test_entrar_com_dados_invalidos_nao_revela_o_motivo(cliente, estudante, login, senha):
    resposta = cliente.post(reverse("entrar"), {"login": login, "senha": senha}, format="json")

    assert resposta.status_code == 400
    assert resposta.json()["non_field_errors"] == ["Usuário, e-mail ou senha incorretos."]


@pytest.mark.django_db
def test_conta_desativada_nao_entra(cliente, estudante):
    estudante.is_active = False
    estudante.save()

    resposta = cliente.post(reverse("entrar"), {"login": "AllexThierry", "senha": SENHA}, format="json")

    assert resposta.status_code == 400


@pytest.mark.django_db
def test_rota_eu_exige_autenticacao(cliente):
    assert cliente.get(reverse("eu")).status_code == 401


@pytest.mark.django_db
def test_rota_eu_devolve_o_usuario_logado(cliente, estudante):
    tokens = cliente.post(reverse("entrar"), {"login": "AllexThierry", "senha": SENHA}, format="json").json()
    cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    resposta = cliente.get(reverse("eu"))

    assert resposta.status_code == 200
    assert resposta.json()["username"] == "AllexThierry"


@pytest.mark.django_db
def test_sair_invalida_o_refresh_token(cliente, estudante):
    tokens = cliente.post(reverse("entrar"), {"login": "AllexThierry", "senha": SENHA}, format="json").json()
    cliente.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access']}")

    assert cliente.post(reverse("sair"), {"refresh": tokens["refresh"]}, format="json").status_code == 204

    cliente.credentials()
    renovar = cliente.post(reverse("renovar-token"), {"refresh": tokens["refresh"]}, format="json")
    assert renovar.status_code == 401


@pytest.mark.django_db
def test_login_e_limitado_apos_muitas_tentativas(cliente, estudante):
    from rest_framework.throttling import ScopedRateThrottle

    ScopedRateThrottle.THROTTLE_RATES = {**ScopedRateThrottle.THROTTLE_RATES, "entrar": "3/min"}
    try:
        respostas = [
            cliente.post(
                reverse("entrar"), {"login": "AllexThierry", "senha": "errada"}, format="json"
            ).status_code
            for _ in range(4)
        ]
    finally:
        ScopedRateThrottle.THROTTLE_RATES = {**ScopedRateThrottle.THROTTLE_RATES, "entrar": "10/min"}

    assert respostas == [400, 400, 400, 429]


# ---------------------------------------------------------------- recuperação de senha


def _link_do_email():
    return re.search(r"/redefinir-senha/([^/\s]+)/([^/\s]+)", mail.outbox[-1].body).groups()


@pytest.mark.django_db
def test_esqueci_senha_envia_email_com_link(cliente, estudante, settings):
    settings.FRONTEND_URL = "https://sabia.exemplo"

    resposta = cliente.post(reverse("esqueci-senha"), {"login": "AllexThierry"}, format="json")

    assert resposta.status_code == 200
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["allex@exemplo.com"]
    assert "https://sabia.exemplo/redefinir-senha/" in mail.outbox[0].body


@pytest.mark.django_db
@pytest.mark.parametrize("login", ["ninguem", "sem_email"])
def test_esqueci_senha_responde_igual_sem_enviar_quando_nao_ha_como(cliente, estudante, login):
    Usuario.objects.create_user(username="sem_email", password=SENHA)
    esperado = cliente.post(reverse("esqueci-senha"), {"login": "AllexThierry"}, format="json").json()
    mail.outbox.clear()

    resposta = cliente.post(reverse("esqueci-senha"), {"login": login}, format="json")

    assert resposta.status_code == 200
    assert resposta.json() == esperado
    assert mail.outbox == []


@pytest.mark.django_db
def test_redefinir_senha_com_link_valido(cliente, estudante):
    cliente.post(reverse("esqueci-senha"), {"login": "allex@exemplo.com"}, format="json")
    uid, token = _link_do_email()
    nova = "NovaSenha#Sabia9"

    resposta = cliente.post(
        reverse("redefinir-senha"),
        {"uid": uid, "token": token, "nova_senha": nova, "confirmar_senha": nova},
        format="json",
    )

    assert resposta.status_code == 200
    estudante.refresh_from_db()
    assert estudante.check_password(nova)


@pytest.mark.django_db
def test_link_de_redefinicao_so_vale_uma_vez(cliente, estudante):
    cliente.post(reverse("esqueci-senha"), {"login": "AllexThierry"}, format="json")
    uid, token = _link_do_email()
    corpo = {
        "uid": uid,
        "token": token,
        "nova_senha": "NovaSenha#Sabia9",
        "confirmar_senha": "NovaSenha#Sabia9",
    }

    assert cliente.post(reverse("redefinir-senha"), corpo, format="json").status_code == 200
    segunda = cliente.post(reverse("redefinir-senha"), corpo, format="json")

    assert segunda.status_code == 400
    assert "inválido ou expirou" in segunda.json()["non_field_errors"][0]


@pytest.mark.django_db
def test_redefinir_senha_com_token_falso(cliente, estudante):
    resposta = cliente.post(
        reverse("redefinir-senha"),
        {
            "uid": "abc",
            "token": "falso",
            "nova_senha": "NovaSenha#Sabia9",
            "confirmar_senha": "NovaSenha#Sabia9",
        },
        format="json",
    )

    assert resposta.status_code == 400
