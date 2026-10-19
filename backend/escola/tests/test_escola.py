import pytest
from rest_framework.test import APIClient

from escola.models import ALFABETO_CODIGO, Turma
from escola.tests.auxiliares import disciplina
from usuarios.models import Usuario

SENHA = "Sabia#Forte2026"


@pytest.fixture
def professor(db):
    return Usuario.objects.create_user(username="prof", password=SENHA, perfil="professor")


@pytest.fixture
def outro_professor(db):
    return Usuario.objects.create_user(username="outra", password=SENHA, perfil="professor")


@pytest.fixture
def estudante(db):
    return Usuario.objects.create_user(
        username="ana", password=SENHA, first_name="Ana", last_name="Lima", email="ana@escola.com"
    )


def logado(usuario):
    cliente = APIClient()
    cliente.force_authenticate(usuario)
    return cliente


# --- disciplinas ----------------------------------------------------------------------------


def test_cadastra_disciplina_sem_repetir(professor):
    cliente = logado(professor)
    resposta = cliente.post("/api/disciplinas/", {"nome": "  Ciências   da Natureza "}, format="json")
    assert resposta.status_code == 201
    assert resposta.data["nome"] == "Ciências da Natureza"

    repetida = cliente.post("/api/disciplinas/", {"nome": "CIÊNCIAS DA NATUREZA"}, format="json")
    assert repetida.status_code == 400
    assert repetida.data["nome"] == ["Você já cadastrou essa disciplina."]

    vazia = cliente.post("/api/disciplinas/", {"nome": "   "}, format="json")
    assert vazia.data["nome"] == ["Digite o nome da disciplina."]


def test_cada_professor_ve_so_as_suas_disciplinas(professor, outro_professor):
    disciplina(professor, "Física")
    disciplina(professor, "Artes")
    disciplina(outro_professor, "Química")
    nomes = [d["nome"] for d in logado(professor).get("/api/disciplinas/").data]
    assert nomes == ["Artes", "Física"]


def test_estudante_nao_acessa_disciplinas(estudante):
    assert logado(estudante).get("/api/disciplinas/").status_code == 403


# --- turmas (professor) ---------------------------------------------------------------------


def test_cria_turma_com_codigo(professor):
    resposta = logado(professor).post("/api/turmas/", {"nome": "8º Ano A"}, format="json")
    assert resposta.status_code == 201
    assert resposta.data["alunos_total"] == 0
    assert resposta.data["alunos"] == []
    codigo = resposta.data["codigo"]
    assert len(codigo) == 6 and set(codigo) <= set(ALFABETO_CODIGO)


def test_turma_com_nome_repetido(professor, outro_professor):
    Turma.objects.create(dono=professor, nome="8º Ano A")
    assert logado(outro_professor).post("/api/turmas/", {"nome": "8º ano a"}).status_code == 201
    repetida = logado(professor).post("/api/turmas/", {"nome": "8º ano a"})
    assert repetida.data["nome"] == ["Você já tem uma turma com esse nome."]


def test_busca_adiciona_e_remove_aluno(professor, estudante):
    turma = Turma.objects.create(dono=professor, nome="8º Ano A")
    Usuario.objects.create_user(username="prof2", password=SENHA, perfil="professor", first_name="Ana")
    cliente = logado(professor)

    encontrados = cliente.get("/api/alunos/", {"busca": "ana li"}).data
    assert [a["username"] for a in encontrados] == ["ana"]  # professores não aparecem
    assert encontrados[0]["nome"] == "Ana Lima"
    assert cliente.get("/api/alunos/", {"busca": "a"}).data == []  # pelo menos 2 letras

    resposta = cliente.post(f"/api/turmas/{turma.id}/alunos/", {"aluno_id": estudante.id}, format="json")
    assert resposta.status_code == 200
    assert resposta.data["alunos_total"] == 1
    assert resposta.data["alunos"][0]["iniciais"] == "AL"

    assert cliente.get("/api/turmas/").data[0]["alunos_total"] == 1

    resposta = cliente.delete(f"/api/turmas/{turma.id}/alunos/{estudante.id}/")
    assert resposta.data["alunos"] == []


def test_nao_adiciona_professor_nem_id_invalido(professor, outro_professor):
    turma = Turma.objects.create(dono=professor, nome="8º Ano A")
    cliente = logado(professor)
    for aluno_id in (outro_professor.id, "abc", 9999):
        resposta = cliente.post(f"/api/turmas/{turma.id}/alunos/", {"aluno_id": aluno_id}, format="json")
        assert resposta.data["aluno_id"] == ["Estudante não encontrado."]


def test_turma_de_outro_professor_nao_aparece(professor, outro_professor, estudante):
    alheia = Turma.objects.create(dono=outro_professor, nome="9º Ano")
    cliente = logado(professor)
    assert cliente.get(f"/api/turmas/{alheia.id}/").status_code == 404
    assert cliente.post(f"/api/turmas/{alheia.id}/alunos/", {"aluno_id": estudante.id}).status_code == 404


def test_novo_codigo(professor):
    turma = Turma.objects.create(dono=professor, nome="8º Ano A")
    antigo = turma.codigo
    resposta = logado(professor).post(f"/api/turmas/{turma.id}/novo_codigo/")
    assert resposta.data["codigo"] != antigo


# --- turmas (estudante) ---------------------------------------------------------------------


def test_estudante_entra_pelo_codigo_e_sai(professor, estudante):
    turma = Turma.objects.create(dono=professor, nome="8º Ano A", codigo="ABC234")
    cliente = logado(estudante)

    resposta = cliente.post("/api/minhas-turmas/entrar/", {"codigo": " abc 234 "}, format="json")
    assert resposta.status_code == 201
    assert resposta.data == {"id": turma.id, "nome": "8º Ano A", "professor": "prof"}

    de_novo = cliente.post("/api/minhas-turmas/entrar/", {"codigo": "ABC234"}, format="json")
    assert de_novo.data["codigo"] == ["Você já está na turma 8º Ano A."]

    assert [t["nome"] for t in cliente.get("/api/minhas-turmas/").data] == ["8º Ano A"]
    assert cliente.delete(f"/api/minhas-turmas/{turma.id}/").status_code == 204
    assert cliente.get("/api/minhas-turmas/").data == []
    assert turma.alunos.count() == 0


def test_codigo_errado_ou_vazio(estudante):
    cliente = logado(estudante)
    assert cliente.post("/api/minhas-turmas/entrar/", {"codigo": "ZZZZZZ"}).data["codigo"] == [
        "Código não encontrado. Confira com seu professor."
    ]
    assert cliente.post("/api/minhas-turmas/entrar/", {"codigo": ""}).data["codigo"] == [
        "Digite o código da turma."
    ]


def test_estudante_nao_gerencia_turmas(estudante):
    assert logado(estudante).get("/api/turmas/").status_code == 403
    assert logado(estudante).get("/api/alunos/", {"busca": "ana"}).status_code == 403
