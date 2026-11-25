import pytest
from rest_framework.test import APIClient

from usuarios.models import Usuario

SENHA = "Sabia#Forte2026"


@pytest.fixture
def usuario(db):
    return Usuario.objects.create_user(username="ÁllexThierry", password=SENHA, email="allex@exemplo.com")


@pytest.fixture
def cliente(usuario):
    cliente = APIClient()
    cliente.force_authenticate(usuario)
    return cliente


def test_iniciais_e_nome_de_exibicao(usuario):
    assert usuario.nome == "ÁllexThierry"
    assert usuario.iniciais == "ÁT"
    usuario.nome_exibicao = "Állex Thierry Souza"
    assert usuario.nome == "Állex Thierry Souza"
    assert usuario.iniciais == "ÁS"


def test_edita_nome_cor_e_sobre_mim(cliente):
    resposta = cliente.patch(
        "/api/auth/eu/",
        {"nome_exibicao": "  Állex   T. ", "cor_avatar": "roxo", "sobre_mim": " Gosto de ciências. "},
        format="json",
    )
    assert resposta.status_code == 200, resposta.data
    assert resposta.data["nome"] == "Állex T."
    assert resposta.data["cor_avatar"] == "roxo"
    assert resposta.data["sobre_mim"] == "Gosto de ciências."


def test_nome_em_branco_volta_para_o_usuario(cliente, usuario):
    usuario.nome_exibicao = "Outro"
    usuario.save()
    resposta = cliente.patch("/api/auth/eu/", {"nome_exibicao": "   "}, format="json")
    assert resposta.data["nome"] == "ÁllexThierry"


def test_limites_e_cor_invalida(cliente):
    resposta = cliente.patch("/api/auth/eu/", {"sobre_mim": "x" * 201, "cor_avatar": "rosa"}, format="json")
    assert resposta.status_code == 400
    assert resposta.data["sobre_mim"] == ["Use no máximo 200 caracteres."]
    assert resposta.data["cor_avatar"] == ["Escolha uma das cores."]


def test_trocar_email_pede_senha_atual(cliente, usuario):
    sem_senha = cliente.patch("/api/auth/eu/", {"email": "novo@exemplo.com"}, format="json")
    assert sem_senha.status_code == 400
    assert "senha atual" in sem_senha.data["senha_atual"][0]

    errada = cliente.patch("/api/auth/eu/", {"email": "novo@exemplo.com", "senha_atual": "x"}, format="json")
    assert errada.data["senha_atual"] == ["Senha atual incorreta."]

    certa = cliente.patch("/api/auth/eu/", {"email": "Novo@Exemplo.com", "senha_atual": SENHA}, format="json")
    assert certa.status_code == 200
    assert certa.data["email"] == "novo@exemplo.com"


def test_mesmo_email_nao_pede_senha(cliente):
    resposta = cliente.patch(
        "/api/auth/eu/", {"email": "ALLEX@exemplo.com", "cor_avatar": "verde"}, format="json"
    )
    assert resposta.status_code == 200


def test_email_de_outra_conta(cliente, db):
    Usuario.objects.create_user(username="bia", password=SENHA, email="bia@exemplo.com")
    resposta = cliente.patch(
        "/api/auth/eu/", {"email": "bia@exemplo.com", "senha_atual": SENHA}, format="json"
    )
    assert resposta.data["email"] == ["Este e-mail já está em uso por outra conta."]


def test_nao_muda_usuario_nem_perfil(cliente, usuario):
    cliente.patch("/api/auth/eu/", {"username": "outro", "perfil": "professor"}, format="json")
    usuario.refresh_from_db()
    assert usuario.username == "ÁllexThierry" and usuario.perfil == "estudante"


def test_alterar_senha(cliente, usuario):
    url = "/api/auth/alterar-senha/"
    errada = cliente.post(
        url, {"senha_atual": "x", "senha": "Nova#Senha2026", "confirmar_senha": "Nova#Senha2026"}
    )
    assert errada.data["senha_atual"] == ["Senha atual incorreta."]
    diferente = cliente.post(
        url, {"senha_atual": SENHA, "senha": "Nova#Senha2026", "confirmar_senha": "outra"}
    )
    assert diferente.data["confirmar_senha"] == ["As senhas não coincidem."]
    fraca = cliente.post(url, {"senha_atual": SENHA, "senha": "123", "confirmar_senha": "123"})
    assert "senha" in fraca.data
    certa = cliente.post(
        url, {"senha_atual": SENHA, "senha": "Nova#Senha2026", "confirmar_senha": "Nova#Senha2026"}
    )
    assert certa.status_code == 204
    usuario.refresh_from_db()
    assert usuario.check_password("Nova#Senha2026")


def test_precisa_estar_logado(db):
    assert APIClient().patch("/api/auth/eu/", {"cor_avatar": "roxo"}, format="json").status_code == 401
