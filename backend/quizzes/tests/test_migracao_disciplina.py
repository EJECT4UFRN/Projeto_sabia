import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

ANTES = [
    ("quizzes", "0001_inicial"),
    ("escola", "0001_inicial"),
    ("usuarios", "0003_perfil_e_cores_do_avatar"),
]
DEPOIS = [("quizzes", "0002_disciplina_do_cadastro")]


@pytest.mark.django_db(transaction=True)
def test_texto_da_disciplina_vira_cadastro_sem_repetir():
    executor = MigrationExecutor(connection)
    executor.migrate(ANTES)
    antigos = executor.loader.project_state(ANTES).apps
    Usuario = antigos.get_model("usuarios", "Usuario")
    Quiz = antigos.get_model("quizzes", "Quiz")
    professor = Usuario.objects.create(username="prof", perfil="professor")
    outro = Usuario.objects.create(username="outro", perfil="professor")
    for dono, disciplina in [
        (professor, "Ciências"),
        (professor, " ciências "),
        (professor, ""),
        (outro, "Ciências"),
    ]:
        Quiz.objects.create(
            dono=dono, titulo="Q", disciplina=disciplina, disciplina_chave=disciplina.casefold()
        )

    executor = MigrationExecutor(connection)
    executor.migrate(DEPOIS)
    novos = executor.loader.project_state(DEPOIS).apps
    Quiz = novos.get_model("quizzes", "Quiz")
    Disciplina = novos.get_model("escola", "Disciplina")

    assert Disciplina.objects.filter(dono_id=professor.id).count() == 1
    assert Disciplina.objects.filter(dono_id=outro.id).count() == 1
    nomes = list(
        Quiz.objects.filter(dono_id=professor.id).order_by("id").values_list("disciplina__nome", flat=True)
    )
    assert nomes == ["Ciências", "Ciências", None]

    # Volta o banco para o estado atual, para os outros testes.
    MigrationExecutor(connection).migrate(executor.loader.graph.leaf_nodes())
