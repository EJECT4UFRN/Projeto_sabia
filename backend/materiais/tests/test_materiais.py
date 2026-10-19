import io
import os

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from escola.models import Turma
from escola.tests.auxiliares import disciplina
from materiais.models import Conclusao, Material, Visualizacao, id_do_youtube
from materiais.serializers import ler_duracao
from partidas.models import Participante, Partida
from usuarios.models import Usuario

URL = "/api/materiais/"
SENHA = "Sabia#Forte2026"


@pytest.fixture(autouse=True)
def midia_temporaria(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


@pytest.fixture
def professor(db):
    return Usuario.objects.create_user(username="prof", password=SENHA, perfil="professor")


@pytest.fixture
def estudante(db):
    return Usuario.objects.create_user(username="ana", password=SENHA)


@pytest.fixture
def cliente(professor):
    cliente = APIClient()
    cliente.force_authenticate(professor)
    return cliente


@pytest.fixture
def turma(professor):
    return Turma.objects.create(dono=professor, nome="8º Ano A")


def pdf(nome="lista.pdf", tamanho=100):
    return SimpleUploadedFile(nome, b"%PDF-1.4" + b"0" * tamanho, content_type="application/pdf")


def png():
    conteudo = io.BytesIO()
    Image.new("RGB", (4, 4), "orange").save(conteudo, "PNG")
    return SimpleUploadedFile("capa.png", conteudo.getvalue(), content_type="image/png")


def criar_material(dono, **extras):
    extras.setdefault("disciplina", disciplina(dono))
    extras.setdefault("tipo", Material.Tipo.ARTIGO)
    extras.setdefault("url", "https://exemplo.com/artigo")
    extras.setdefault("status", Material.Status.PUBLICADO)
    turmas = extras.pop("turmas", [])
    material = Material.objects.create(dono=dono, titulo=extras.pop("titulo", "Energia solar"), **extras)
    material.turmas.set(turmas)
    return material


# --- regras soltas --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "url, esperado",
    [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://m.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://vimeo.com/123", ""),
        ("https://youtube.com/watch?v=curto", ""),
        ("", ""),
    ],
)
def test_id_do_youtube(url, esperado):
    assert id_do_youtube(url) == esperado


def test_ler_duracao():
    assert ler_duracao("08:30") == 510
    assert ler_duracao(" 1:02:05 ") == 3725
    assert ler_duracao("") is None
    for errada in ("8", "8:7", "aa:bb", "00:00"):
        with pytest.raises(Exception):
            ler_duracao(errada)


# --- professor: criar e editar --------------------------------------------------------------


def test_cria_documento_publicado_para_turma(cliente, professor, turma):
    fisica = disciplina(professor, "Física")
    resposta = cliente.post(
        URL,
        {
            "titulo": "  Movimento   uniforme ",
            "descricao": "Exercícios de revisão.",
            "disciplina": fisica.id,
            "tipo": "documento",
            "arquivo": pdf(),
            "capa": png(),
            "turmas_ids": str(turma.id),
            "status": "publicado",
            "permitir_concluir": "true",
        },
        format="multipart",
    )
    assert resposta.status_code == 201, resposta.data
    dados = resposta.data
    assert dados["titulo"] == "Movimento uniforme"
    assert dados["disciplina_nome"] == "Física"
    assert dados["extensao"] == "PDF"
    assert dados["arquivo_nome"] == "lista.pdf"
    assert dados["arquivo"].startswith("http://testserver/media/materiais/")
    assert dados["capa_url"].endswith(".png")
    assert dados["turmas"] == [{"id": turma.id, "nome": "8º Ano A"}]
    assert dados["permitir_concluir"] is True
    assert dados["visualizacoes"] == 0


def test_cria_video_do_youtube_sem_capa(cliente, professor):
    resposta = cliente.post(
        URL,
        {
            "titulo": "Sistema Solar",
            "disciplina": disciplina(professor).id,
            "tipo": "video",
            "url": "https://youtu.be/dQw4w9WgXcQ",
            "duracao": "8:30",
            "publico": True,
            "status": "publicado",
        },
        format="json",
    )
    assert resposta.status_code == 201, resposta.data
    assert resposta.data["youtube_id"] == "dQw4w9WgXcQ"
    assert resposta.data["duracao"] == "08:30"
    assert resposta.data["capa_url"] == "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg"


def test_validacoes(cliente, professor):
    ciencias = disciplina(professor)
    erros = cliente.post(URL, {"titulo": " ", "tipo": "video"}, format="multipart").data
    assert erros["titulo"] == ["Dê um título para o material."]
    assert erros["disciplina"] == ["Escolha a disciplina."]

    base = {"titulo": "Aula", "disciplina": ciencias.id}
    assert cliente.post(URL, {**base, "tipo": "documento"}).data["arquivo"] == [
        "Envie o arquivo do material."
    ]
    assert cliente.post(URL, {**base, "tipo": "video"}).data["url"] == ["Cole o link do vídeo."]
    assert cliente.post(URL, {**base, "tipo": "artigo", "url": "exemplo"}).data["url"] == [
        "Digite um link completo, começando com https://"
    ]
    imagem = SimpleUploadedFile("foto.png", b"nada", content_type="image/png")
    assert cliente.post(URL, {**base, "tipo": "documento", "arquivo": imagem}).data["arquivo"] == [
        "Envie um arquivo PDF, DOC ou DOCX."
    ]
    publicado_sem_turma = cliente.post(
        URL, {**base, "tipo": "artigo", "url": "https://exemplo.com", "status": "publicado"}
    )
    assert publicado_sem_turma.data["turmas_ids"] == [
        "Escolha ao menos uma turma ou deixe o material público."
    ]
    rascunho = cliente.post(URL, {**base, "tipo": "artigo", "url": "https://exemplo.com", "tempo_leitura": 8})
    assert rascunho.status_code == 201
    assert rascunho.data["tempo_leitura"] == 8


def test_arquivo_grande_demais(cliente, professor, settings):
    from materiais import serializers

    original = serializers.TAMANHO_MAXIMO_ARQUIVO
    serializers.TAMANHO_MAXIMO_ARQUIVO = 50
    try:
        resposta = cliente.post(
            URL,
            {"titulo": "A", "disciplina": disciplina(professor).id, "tipo": "documento", "arquivo": pdf()},
        )
    finally:
        serializers.TAMANHO_MAXIMO_ARQUIVO = original
    assert resposta.data["arquivo"] == ["O arquivo pode ter no máximo 20 MB."]


def test_disciplina_e_turma_de_outro_professor(cliente, db):
    outro = Usuario.objects.create_user(username="outro", password=SENHA, perfil="professor")
    alheia = Turma.objects.create(dono=outro, nome="9º Ano")
    resposta = cliente.post(
        URL,
        {
            "titulo": "A",
            "disciplina": disciplina(outro).id,
            "tipo": "artigo",
            "url": "https://exemplo.com",
            "turmas_ids": str(alheia.id),
        },
    )
    assert resposta.data["disciplina"] == ["Essa disciplina não existe mais. Escolha outra."]
    assert resposta.data["turmas_ids"] == ["Uma das turmas escolhidas não existe mais."]


def test_trocar_tipo_apaga_o_arquivo(cliente, professor, turma):
    criado = cliente.post(
        URL,
        {"titulo": "A", "disciplina": disciplina(professor).id, "tipo": "documento", "arquivo": pdf()},
    ).data
    material = Material.objects.get(pk=criado["id"])
    caminho = material.arquivo.path
    assert os.path.exists(caminho)

    resposta = cliente.patch(
        f"{URL}{material.id}/", {"tipo": "artigo", "url": "https://exemplo.com", "tempo_leitura": 5}
    )
    assert resposta.status_code == 200, resposta.data
    assert resposta.data["arquivo"] is None
    assert not os.path.exists(caminho)


def test_editar_turmas_e_tirar_do_ar(cliente, professor, turma):
    material = criar_material(professor, turmas=[turma])
    resposta = cliente.patch(
        f"{URL}{material.id}/", {"turmas_ids": "", "publico": "true"}, format="multipart"
    )
    assert resposta.data["turmas"] == []
    assert resposta.data["publico"] is True
    assert cliente.patch(f"{URL}{material.id}/", {"publico": False}, format="json").data["turmas_ids"] == [
        "Escolha ao menos uma turma ou deixe o material público."
    ]
    tirado = cliente.patch(f"{URL}{material.id}/", {"status": "rascunho", "publico": False}, format="json")
    assert tirado.data["status"] == "rascunho"


def test_excluir_apaga_arquivo_e_capa(cliente, professor):
    criado = cliente.post(
        URL,
        {
            "titulo": "A",
            "disciplina": disciplina(professor).id,
            "tipo": "documento",
            "arquivo": pdf(),
            "capa": png(),
        },
    ).data
    material = Material.objects.get(pk=criado["id"])
    caminhos = [material.arquivo.path, material.capa.path]
    assert cliente.delete(f"{URL}{material.id}/").status_code == 204
    assert not any(os.path.exists(c) for c in caminhos)


def test_disciplina_com_material_nao_pode_ser_excluida(cliente, professor):
    material = criar_material(professor, publico=True)
    resposta = cliente.delete(f"/api/disciplinas/{material.disciplina_id}/")
    assert resposta.status_code == 409


def test_lista_filtros_e_resumo(cliente, professor, estudante):
    fisica = disciplina(professor, "Física")
    video = criar_material(professor, titulo="Sistema Solar", tipo="video", publico=True)
    criar_material(professor, titulo="Leis de Newton", disciplina=fisica, tipo="documento", status="rascunho")
    criar_material(professor, titulo="Reciclagem", publico=True)
    Visualizacao.objects.create(material=video, usuario=estudante)

    def titulos(**filtros):
        return [m["titulo"] for m in cliente.get(URL, filtros).data["results"]]

    assert titulos() == ["Reciclagem", "Leis de Newton", "Sistema Solar"]
    assert titulos(busca="física") == ["Leis de Newton"]
    assert titulos(disciplina=fisica.id) == ["Leis de Newton"]
    assert titulos(tipo="video") == ["Sistema Solar"]
    assert titulos(status="rascunho") == ["Leis de Newton"]
    assert cliente.get(URL, {"tipo": "video"}).data["results"][0]["visualizacoes"] == 1
    assert cliente.get(f"{URL}resumo/").data == {
        "publicados": 2,
        "rascunhos": 1,
        "videos": 1,
        "documentos": 1,
        "artigos": 1,
    }


def test_estudante_nao_acessa_o_painel(estudante):
    cliente = APIClient()
    cliente.force_authenticate(estudante)
    assert cliente.get(URL).status_code == 403


# --- "Continue aprendendo" ------------------------------------------------------------------


def test_quem_ve_cada_material(professor, estudante, turma):
    colega = Usuario.objects.create_user(username="beto", password=SENHA)
    turma.alunos.add(estudante)
    criar_material(professor, titulo="Público", publico=True)
    criar_material(professor, titulo="Da turma", turmas=[turma])
    criar_material(professor, titulo="Rascunho", publico=True, status="rascunho")

    def titulos(usuario=None):
        cliente = APIClient()
        if usuario:
            cliente.force_authenticate(usuario)
        return sorted(m["titulo"] for m in cliente.get("/api/estudo/").data["results"])

    assert titulos() == ["Público"]
    assert titulos(colega) == ["Público"]
    assert titulos(estudante) == ["Da turma", "Público"]


def test_recomendados_primeiro(professor, estudante):
    criar_material(
        professor, titulo="Física antiga", disciplina=disciplina(professor, "Física"), publico=True
    )
    criar_material(professor, titulo="Arte nova", disciplina=disciplina(professor, "Artes"), publico=True)
    partida = Partida.objects.create(professor=professor, titulo="Q", disciplina="FÍSICA", pin="123456")
    Participante.objects.create(partida=partida, usuario=estudante, apelido="ana")

    cliente = APIClient()
    cliente.force_authenticate(estudante)
    assert [m["titulo"] for m in cliente.get("/api/estudo/").data["results"]] == [
        "Física antiga",
        "Arte nova",
    ]
    assert [m["titulo"] for m in APIClient().get("/api/estudo/").data["results"]] == [
        "Arte nova",
        "Física antiga",
    ]


def test_busca_e_formato(professor):
    criar_material(
        professor, titulo="Painel solar", tipo="video", url="https://youtu.be/dQw4w9WgXcQ", publico=True
    )
    criar_material(professor, titulo="Reciclagem", publico=True)
    cliente = APIClient()
    assert [m["titulo"] for m in cliente.get("/api/estudo/", {"busca": "SOLAR"}).data["results"]] == [
        "Painel solar"
    ]
    [video] = cliente.get("/api/estudo/", {"tipo": "video"}).data["results"]
    assert video["youtube_id"] == "dQw4w9WgXcQ"
    assert video["professor"] == "prof"


def test_abrir_conta_uma_visualizacao_por_estudante(professor, estudante):
    material = criar_material(professor, publico=True)
    cliente = APIClient()
    cliente.force_authenticate(estudante)
    cliente.get(f"/api/estudo/{material.id}/")
    cliente.get(f"/api/estudo/{material.id}/")
    APIClient().get(f"/api/estudo/{material.id}/")  # visitante não conta
    dono = APIClient()
    dono.force_authenticate(professor)
    dono.get(f"/api/estudo/{material.id}/")  # o próprio professor não conta
    assert material.visualizacoes.count() == 1


def test_material_fora_do_alcance_da_404(professor, estudante, turma):
    material = criar_material(professor, turmas=[turma])
    rascunho = criar_material(professor, publico=True, status="rascunho")
    cliente = APIClient()
    cliente.force_authenticate(estudante)
    assert cliente.get(f"/api/estudo/{material.id}/").status_code == 404
    assert cliente.get(f"/api/estudo/{rascunho.id}/").status_code == 404
    # O professor pré-visualiza o próprio rascunho.
    dono = APIClient()
    dono.force_authenticate(professor)
    assert dono.get(f"/api/estudo/{rascunho.id}/").status_code == 200


def test_marcar_como_concluido(professor, estudante):
    material = criar_material(professor, publico=True, permitir_concluir=True)
    proibido = criar_material(professor, publico=True)
    cliente = APIClient()
    cliente.force_authenticate(estudante)

    assert cliente.post(f"/api/estudo/{material.id}/concluir/").data["concluido"] is True
    assert cliente.get("/api/estudo/").data["results"][1]["concluido"] is True
    assert cliente.delete(f"/api/estudo/{material.id}/concluir/").data["concluido"] is False
    assert not Conclusao.objects.exists()
    assert cliente.post(f"/api/estudo/{proibido.id}/concluir/").status_code == 403
    assert APIClient().post(f"/api/estudo/{material.id}/concluir/").status_code == 401
