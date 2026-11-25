import secrets

from django.conf import settings
from django.db import models

# Código que o estudante digita no perfil para entrar na turma: 6 caracteres, sem letras
# que se confundem (0/O, 1/I/L).
ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
TAMANHO_CODIGO = 6


def juntar_espacos(texto):
    return " ".join((texto or "").split())


def gerar_codigo_turma():
    while True:
        codigo = "".join(secrets.choice(ALFABETO_CODIGO) for _ in range(TAMANHO_CODIGO))
        if not Turma.objects.filter(codigo=codigo).exists():
            return codigo


class ComChave(models.Model):
    """Nome com uma "chave" em minúsculas para comparar sem diferenciar "Ciências" de "CIÊNCIAS"
    (o SQLite não ignora maiúsculas em letras acentuadas)."""

    nome = models.CharField(max_length=60)
    chave = models.CharField(max_length=60, editable=False, db_index=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        self.nome = juntar_espacos(self.nome)
        self.chave = self.nome.casefold()
        if kwargs.get("update_fields") is not None and "nome" in kwargs["update_fields"]:
            kwargs["update_fields"] = {*kwargs["update_fields"], "chave"}
        super().save(*args, **kwargs)

    def __str__(self):
        return self.nome


class Disciplina(ComChave):
    """Matéria (ex.: Ciências) usada nos quizzes e nos materiais. Cada professor tem as suas."""

    dono = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="disciplinas")
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["chave"]
        constraints = [
            models.UniqueConstraint("dono", "chave", name="disciplina_unica_por_professor"),
        ]


class Turma(ComChave):
    """Turma do professor (ex.: 8º Ano A). O professor adiciona os estudantes pela busca, ou o
    estudante entra sozinho digitando o código no perfil. Material só para turmas aparece
    apenas para os estudantes delas."""

    dono = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="turmas")
    codigo = models.CharField(max_length=TAMANHO_CODIGO, unique=True, default=gerar_codigo_turma)
    alunos = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name="turmas_que_participa", blank=True)
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["chave"]
        constraints = [
            models.UniqueConstraint("dono", "chave", name="turma_unica_por_professor"),
        ]
