from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from escola.models import Disciplina
from perguntas.models import (
    PONTUACAO_MAXIMA,
    PONTUACAO_MINIMA,
    PONTUACAO_PADRAO,
    TEMPO_MAXIMO,
    TEMPO_MINIMO,
    TEMPO_PADRAO,
    Pergunta,
)


class Quiz(models.Model):
    """Jogo montado pelo professor com perguntas em ordem.

    Regras confirmadas:
    - só quiz publicado pode iniciar partida; para publicar precisa de ao menos 1 pergunta;
    - o quiz fica salvo e pode ser jogado quantas vezes o professor quiser, até ele excluir;
    - a disciplina vem do cadastro de disciplinas do professor; turma é texto livre e opcional;
    - tempo e pontuação padrão só pré-preenchem perguntas criadas dentro do quiz;
    - embaralhar sorteia uma ordem nova a cada partida, a mesma para todos os estudantes.
    """

    class Status(models.TextChoices):
        RASCUNHO = "rascunho", "Rascunho"
        PUBLICADO = "publicado", "Publicado"

    dono = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="quizzes")
    titulo = models.CharField("título", max_length=120)
    descricao = models.CharField("descrição", max_length=500, blank=True)
    disciplina = models.ForeignKey(
        Disciplina, on_delete=models.SET_NULL, null=True, blank=True, related_name="quizzes"
    )
    turma = models.CharField(max_length=60, blank=True)
    dificuldade = models.CharField(
        max_length=10, choices=Pergunta.Dificuldade.choices, default=Pergunta.Dificuldade.MEDIO
    )
    tempo_padrao = models.PositiveSmallIntegerField(
        "tempo padrão (segundos)",
        default=TEMPO_PADRAO,
        validators=[MinValueValidator(TEMPO_MINIMO), MaxValueValidator(TEMPO_MAXIMO)],
    )
    pontuacao_padrao = models.PositiveIntegerField(
        "pontuação padrão",
        default=PONTUACAO_PADRAO,
        validators=[MinValueValidator(PONTUACAO_MINIMA), MaxValueValidator(PONTUACAO_MAXIMA)],
    )
    embaralhar_perguntas = models.BooleanField(default=False)
    embaralhar_respostas = models.BooleanField(default=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.RASCUNHO)
    favorito = models.BooleanField(default=False)
    perguntas = models.ManyToManyField(Pergunta, through="QuizPergunta", related_name="quizzes")
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-atualizado_em", "-id"]
        verbose_name_plural = "quizzes"

    @property
    def pode_iniciar(self):
        return self.status == self.Status.PUBLICADO and self.itens.exists()

    def perguntas_exclusivas(self):
        """Cópias que só existem neste quiz (fora do banco)."""
        return Pergunta.objects.filter(quizzes=self, no_banco=False)

    def __str__(self):
        return self.titulo


class QuizPergunta(models.Model):
    quiz = models.ForeignKey(Quiz, on_delete=models.CASCADE, related_name="itens")
    # PROTECT: pergunta que está em algum quiz não pode ser excluída do banco (só desativada).
    pergunta = models.ForeignKey(Pergunta, on_delete=models.PROTECT, related_name="usos")
    ordem = models.PositiveSmallIntegerField()

    class Meta:
        ordering = ["ordem"]
        constraints = [
            models.UniqueConstraint("quiz", "pergunta", name="pergunta_unica_no_quiz"),
        ]
