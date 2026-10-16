import io
import os

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from PIL import Image
from rest_framework.test import APIClient

from perguntas.models import Categoria, Pergunta
from usuarios.models import Usuario


@pytest.fixture(autouse=True)
def midia_temporaria(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


@pytest.fixture
def professor():
    return Usuario.objects.create_user(username="prof", password="Sabia#Forte2026", perfil="professor")


@pytest.fixture
def outro_professor():
    return Usuario.objects.create_user(username="outra_prof", password="Sabia#Forte2026", perfil="professor")


@pytest.fixture
def cliente(professor):
    cliente = APIClient()
    cliente.force_authenticate(professor)
    return cliente


@pytest.fixture
def categoria(professor):
    return Categoria.objects.create(dono=professor, nome="Energia Solar")


def dados_pergunta(**extras):
    return {
        "texto": "O que é o efeito fotovoltaico?",
        "alternativa_a": "Reação química que gera calor",
        "alternativa_b": "Conversão da luz solar em energia elétrica",
        "alternativa_c": "Armazenamento de energia em baterias",
        "alternativa_d": "Reciclagem de painéis usados",
        "resposta_correta": "B",
        **extras,
    }


def criar_pergunta(dono, **extras):
    return Pergunta.objects.create(dono=dono, **dados_pergunta(**extras))


def imagem_png(nome="figura.png", tamanho=(20, 20)):
    buffer = io.BytesIO()
    Image.new("RGB", tamanho, "orange").save(buffer, "PNG")
    return SimpleUploadedFile(nome, buffer.getvalue(), content_type="image/png")


LISTA = reverse("pergunta-list")


def detalhe(pergunta):
    return reverse("pergunta-detail", args=[pergunta.pk])


# ---------------------------------------------------------------- permissões


@pytest.mark.django_db
def test_visitante_nao_acessa_o_banco():
    assert APIClient().get(LISTA).status_code == 401


@pytest.mark.django_db
def test_estudante_nao_acessa_o_banco():
    estudante = Usuario.objects.create_user(username="aluno", password="Sabia#Forte2026")
    cliente = APIClient()
    cliente.force_authenticate(estudante)

    resposta = cliente.get(LISTA)

    assert resposta.status_code == 403
    assert resposta.json()["detail"] == "Esta área é exclusiva para professores."


@pytest.mark.django_db
def test_professor_so_ve_as_proprias_perguntas(cliente, professor, outro_professor):
    criar_pergunta(professor, texto="Minha pergunta")
    alheia = criar_pergunta(outro_professor, texto="Pergunta de outra pessoa")

    resposta = cliente.get(LISTA)

    assert [p["texto"] for p in resposta.json()["results"]] == ["Minha pergunta"]
    assert cliente.get(detalhe(alheia)).status_code == 404
    assert cliente.patch(detalhe(alheia), {"ativa": False}, format="json").status_code == 404
    assert cliente.delete(detalhe(alheia)).status_code == 404


# ---------------------------------------------------------------- criar


@pytest.mark.django_db
def test_cria_pergunta_com_valores_padrao(cliente, professor):
    resposta = cliente.post(LISTA, dados_pergunta(), format="json")

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["resposta_correta"] == "B"
    assert corpo["dificuldade"] == "medio"
    assert corpo["tempo_limite"] == 20
    assert corpo["pontuacao_maxima"] == 1000
    assert corpo["ativa"] is True
    assert corpo["categoria"] is None
    assert Pergunta.objects.get().dono == professor


@pytest.mark.django_db
def test_cria_pergunta_com_categoria_e_imagem_via_formulario(cliente, categoria):
    resposta = cliente.post(
        LISTA,
        dados_pergunta(categoria=categoria.pk, dificuldade="facil", imagem=imagem_png()),
        format="multipart",
    )

    assert resposta.status_code == 201
    corpo = resposta.json()
    assert corpo["categoria_nome"] == "Energia Solar"
    assert corpo["imagem"].endswith(".png")


@pytest.mark.django_db
@pytest.mark.parametrize(
    "extras, campo, mensagem",
    [
        ({"texto": "   "}, "texto", "Escreva o texto da pergunta."),
        ({"alternativa_c": ""}, "alternativa_c", "Preencha esta alternativa."),
        ({"resposta_correta": ""}, "resposta_correta", "Marque qual alternativa é a correta."),
        ({"resposta_correta": "E"}, "resposta_correta", "Marque qual alternativa é a correta."),
        ({"tempo_limite": 2}, "tempo_limite", "O tempo mínimo é 5 segundos."),
        ({"tempo_limite": 301}, "tempo_limite", "O tempo máximo é 300 segundos."),
        ({"pontuacao_maxima": 50}, "pontuacao_maxima", "A pontuação mínima é 100."),
        ({"pontuacao_maxima": 2001}, "pontuacao_maxima", "A pontuação máxima é 2000."),
        (
            {"alternativa_d": "  conversão da luz solar em energia ELÉTRICA "},
            "alternativa_d",
            "Esta alternativa repete outra. Cada opção precisa ser diferente.",
        ),
    ],
)
def test_validacoes_da_pergunta(cliente, extras, campo, mensagem):
    resposta = cliente.post(LISTA, dados_pergunta(**extras), format="json")

    assert resposta.status_code == 400
    assert resposta.json()[campo] == [mensagem]


@pytest.mark.django_db
def test_nao_aceita_categoria_de_outro_professor(cliente, outro_professor):
    alheia = Categoria.objects.create(dono=outro_professor, nome="Alheia")

    resposta = cliente.post(LISTA, dados_pergunta(categoria=alheia.pk), format="json")

    assert resposta.status_code == 400
    assert "categoria" in resposta.json()


@pytest.mark.django_db
def test_recusa_arquivo_que_nao_e_imagem(cliente):
    falso = SimpleUploadedFile("virus.png", b"isto nao e uma imagem", content_type="image/png")

    resposta = cliente.post(LISTA, dados_pergunta(imagem=falso), format="multipart")

    assert resposta.status_code == 400
    assert "imagem" in resposta.json()


@pytest.mark.django_db
def test_recusa_imagem_maior_que_5mb(cliente, monkeypatch):
    monkeypatch.setattr("perguntas.serializers.TAMANHO_MAXIMO_IMAGEM", 10)

    resposta = cliente.post(LISTA, dados_pergunta(imagem=imagem_png()), format="multipart")

    assert resposta.status_code == 400
    assert resposta.json()["imagem"] == ["A imagem pode ter no máximo 5 MB."]


# ---------------------------------------------------------------- editar


@pytest.mark.django_db
def test_edita_pergunta_e_troca_a_correta(cliente, professor):
    pergunta = criar_pergunta(professor)

    resposta = cliente.patch(
        detalhe(pergunta), {"resposta_correta": "D", "ativa": False, "tempo_limite": 45}, format="json"
    )

    assert resposta.status_code == 200
    pergunta.refresh_from_db()
    assert (pergunta.resposta_correta, pergunta.ativa, pergunta.tempo_limite) == ("D", False, 45)


@pytest.mark.django_db
def test_edicao_parcial_ainda_impede_alternativa_repetida(cliente, professor):
    pergunta = criar_pergunta(professor)

    resposta = cliente.patch(detalhe(pergunta), {"alternativa_a": pergunta.alternativa_b}, format="json")

    assert resposta.status_code == 400
    assert "alternativa_a" in resposta.json()


@pytest.mark.django_db
def test_remove_a_imagem(cliente, professor):
    pergunta = criar_pergunta(professor)
    pergunta.imagem = imagem_png()
    pergunta.save()
    caminho = pergunta.imagem.path

    resposta = cliente.patch(detalhe(pergunta), {"remover_imagem": "true"}, format="multipart")

    assert resposta.status_code == 200
    assert resposta.json()["imagem"] is None

    assert not os.path.exists(caminho)


# ---------------------------------------------------------------- excluir


@pytest.mark.django_db
def test_exclui_pergunta(cliente, professor):
    pergunta = criar_pergunta(professor)

    assert cliente.delete(detalhe(pergunta)).status_code == 204
    assert not Pergunta.objects.exists()


# ---------------------------------------------------------------- listar e filtrar


@pytest.mark.django_db
def test_filtros_da_lista(cliente, professor, categoria):
    outra = Categoria.objects.create(dono=professor, nome="Economia Circular")
    criar_pergunta(
        professor, texto="O que é o efeito fotovoltaico?", categoria=categoria, dificuldade="facil"
    )
    criar_pergunta(professor, texto="O que é economia circular?", categoria=outra, dificuldade="medio")
    criar_pergunta(professor, texto="Qual componente converte corrente?", categoria=categoria, ativa=False)

    def textos(**filtros):
        return sorted(p["texto"] for p in cliente.get(LISTA, filtros).json()["results"])

    assert textos(busca="  efeito   fotovoltaico ") == ["O que é o efeito fotovoltaico?"]
    assert textos(busca="economia") == ["O que é economia circular?"]
    assert len(textos(categoria=categoria.pk)) == 2
    assert textos(dificuldade="facil") == ["O que é o efeito fotovoltaico?"]
    assert textos(ativa="false") == ["Qual componente converte corrente?"]
    assert len(textos(dificuldade="invalida")) == 3


@pytest.mark.django_db
def test_lista_paginada_de_10_em_10_mais_recentes_primeiro(cliente, professor):
    for numero in range(12):
        criar_pergunta(professor, texto=f"Pergunta {numero}")

    pagina_1 = cliente.get(LISTA).json()
    pagina_2 = cliente.get(LISTA, {"pagina": 2}).json()

    assert pagina_1["count"] == 12
    assert len(pagina_1["results"]) == 10
    assert pagina_1["results"][0]["texto"] == "Pergunta 11"
    assert len(pagina_2["results"]) == 2


# ---------------------------------------------------------------- categorias


@pytest.mark.django_db
def test_cria_e_lista_categorias_do_professor(cliente, outro_professor):
    Categoria.objects.create(dono=outro_professor, nome="Não é minha")

    criada = cliente.post(reverse("categoria-list"), {"nome": "  Energia   Solar "}, format="json")
    lista = cliente.get(reverse("categoria-list")).json()

    assert criada.status_code == 201
    assert lista == [{"id": criada.json()["id"], "nome": "Energia Solar"}]


@pytest.mark.django_db
def test_nao_repete_categoria_sem_diferenciar_maiusculas(cliente, categoria):
    resposta = cliente.post(reverse("categoria-list"), {"nome": "energia solar"}, format="json")

    assert resposta.status_code == 400
    assert resposta.json()["nome"] == ["Você já tem uma categoria com esse nome."]


@pytest.mark.django_db
def test_outro_professor_pode_ter_categoria_com_mesmo_nome(outro_professor, categoria):
    cliente = APIClient()
    cliente.force_authenticate(outro_professor)

    resposta = cliente.post(reverse("categoria-list"), {"nome": "Energia Solar"}, format="json")

    assert resposta.status_code == 201
