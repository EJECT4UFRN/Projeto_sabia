import uuid

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower

LIMITE_MINIMO, LIMITE_MAXIMO, LIMITE_PADRAO = 1, 500, 50


class Partida(models.Model):
    """Uma sala aberta pelo professor para jogar um quiz ao vivo.

    As perguntas são copiadas para `perguntas` (JSON) na hora de abrir a sala, já na ordem
    sorteada e com a ordem das alternativas sorteada (quando o quiz pede para embaralhar).
    Assim a partida não muda se o quiz ou as perguntas forem editados durante o jogo, e o
    histórico continua legível mesmo se o quiz for excluído.
    """

    class Estado(models.TextChoices):
        SALA = "sala", "Sala aberta"
        PERGUNTA = "pergunta", "Pergunta em andamento"
        RESULTADO = "resultado", "Resultado da pergunta"
        RANKING = "ranking", "Ranking parcial"
        ENCERRADA = "encerrada", "Encerrada"
        CANCELADA = "cancelada", "Cancelada"

    ATIVAS = (Estado.SALA, Estado.PERGUNTA, Estado.RESULTADO, Estado.RANKING)

    professor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="partidas")
    quiz = models.ForeignKey(
        "quizzes.Quiz", on_delete=models.SET_NULL, null=True, blank=True, related_name="partidas"
    )
    titulo = models.CharField(max_length=120)
    disciplina = models.CharField(max_length=60, blank=True)
    pin = models.CharField(max_length=6, db_index=True)
    limite_participantes = models.PositiveSmallIntegerField(
        default=LIMITE_PADRAO,
        validators=[MinValueValidator(LIMITE_MINIMO), MaxValueValidator(LIMITE_MAXIMO)],
    )
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.SALA)
    perguntas = models.JSONField(default=list)
    indice = models.SmallIntegerField(default=-1)
    pergunta_iniciada_em = models.DateTimeField(null=True, blank=True)
    prazo = models.DateTimeField(null=True, blank=True)
    criada_em = models.DateTimeField(auto_now_add=True)
    iniciada_em = models.DateTimeField(null=True, blank=True)
    encerrada_em = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-criada_em", "-id"]

    @property
    def ativa(self):
        return self.estado in self.ATIVAS

    @property
    def pergunta_atual(self):
        if 0 <= self.indice < len(self.perguntas):
            return self.perguntas[self.indice]
        return None

    def __str__(self):
        return f"{self.titulo} ({self.pin})"


class Participante(models.Model):
    partida = models.ForeignKey(Partida, on_delete=models.CASCADE, related_name="participantes")
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="participacoes",
    )
    apelido = models.CharField(max_length=30)
    # Guardada no aparelho do estudante: permite voltar à partida sem perder os pontos.
    chave = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    pontos = models.PositiveIntegerField(default=0)
    acertos = models.PositiveSmallIntegerField(default=0)
    sequencia = models.PositiveSmallIntegerField(default=0)
    maior_sequencia = models.PositiveSmallIntegerField(default=0)
    posicao_anterior = models.PositiveSmallIntegerField(null=True, blank=True)
    removido = models.BooleanField(default=False)
    entrou_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-pontos", "entrou_em", "id"]
        constraints = [
            models.UniqueConstraint(
                Lower("apelido"), "partida", condition=Q(removido=False), name="apelido_unico_na_partida"
            ),
        ]

    def __str__(self):
        return self.apelido


class Resposta(models.Model):
    class Letra(models.TextChoices):
        A = "A", "A"
        B = "B", "B"
        C = "C", "C"
        D = "D", "D"

    participante = models.ForeignKey(Participante, on_delete=models.CASCADE, related_name="respostas")
    indice = models.PositiveSmallIntegerField("número da pergunta na partida (começa em 0)")
    letra = models.CharField(max_length=1, choices=Letra.choices)
    correta = models.BooleanField()
    tempo_ms = models.PositiveIntegerField()
    pontos = models.PositiveIntegerField(default=0)
    bonus = models.PositiveIntegerField(default=0)
    respondida_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["indice"]
        constraints = [
            models.UniqueConstraint("participante", "indice", name="uma_resposta_por_pergunta"),
        ]
