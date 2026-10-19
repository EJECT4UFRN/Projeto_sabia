"""A disciplina do quiz deixa de ser texto livre e passa a vir do cadastro de disciplinas.

Os textos já digitados viram disciplinas do professor dono do quiz (sem repetir
"Ciências" e "ciências").
"""

import django.db.models.deletion
from django.db import migrations, models


def texto_para_cadastro(apps, schema_editor):
    Quiz = apps.get_model("quizzes", "Quiz")
    Disciplina = apps.get_model("escola", "Disciplina")
    # Do mais antigo para o mais novo: o primeiro jeito de escrever o nome é o que fica.
    for quiz in Quiz.objects.exclude(disciplina="").order_by("criado_em", "id"):
        nome = " ".join(quiz.disciplina.split())
        if not nome:
            continue
        disciplina, _ = Disciplina.objects.get_or_create(
            dono_id=quiz.dono_id, chave=nome.casefold(), defaults={"nome": nome}
        )
        quiz.disciplina_cadastrada = disciplina
        quiz.save(update_fields=["disciplina_cadastrada"])


def cadastro_para_texto(apps, schema_editor):
    Quiz = apps.get_model("quizzes", "Quiz")
    for quiz in Quiz.objects.exclude(disciplina_cadastrada=None).select_related("disciplina_cadastrada"):
        quiz.disciplina = quiz.disciplina_cadastrada.nome
        quiz.disciplina_chave = quiz.disciplina_cadastrada.chave
        quiz.save(update_fields=["disciplina", "disciplina_chave"])


class Migration(migrations.Migration):
    dependencies = [
        ("escola", "0001_inicial"),
        ("quizzes", "0001_inicial"),
    ]

    operations = [
        migrations.AddField(
            model_name="quiz",
            name="disciplina_cadastrada",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="quizzes",
                to="escola.disciplina",
            ),
        ),
        migrations.RunPython(texto_para_cadastro, cadastro_para_texto),
        migrations.RemoveField(model_name="quiz", name="disciplina_chave"),
        migrations.RemoveField(model_name="quiz", name="disciplina"),
        migrations.RenameField(model_name="quiz", old_name="disciplina_cadastrada", new_name="disciplina"),
    ]
