import os

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models.functions import Lower

# Limites dos campos numéricos da pergunta (os mesmos valem na validação da API).
TEMPO_MINIMO, TEMPO_MAXIMO, TEMPO_PADRAO = 5, 300, 20
PONTUACAO_MINIMA, PONTUACAO_MAXIMA, PONTUACAO_PADRAO = 100, 2000, 1000


class Categoria(models.Model):
    """Tema da pergunta (ex.: Energia Solar). Cada professor tem as suas.

    É diferente da disciplina (ex.: Ciências), que fica no quiz e nos materiais.
    """

    dono = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="categorias")
    nome = models.CharField(max_length=60)
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = [Lower("nome")]
        constraints = [
            models.UniqueConstraint(Lower("nome"), "dono", name="categoria_unica_por_professor"),
        ]

    def __str__(self):
        return self.nome


def caminho_imagem_pergunta(pergunta, nome_arquivo):
    return f"perguntas/{pergunta.dono_id}/{nome_arquivo}"


class Pergunta(models.Model):
    """Pergunta de múltipla escolha: sempre 4 alternativas e exatamente uma correta.

    Tempo limite e pontuação máxima são da própria pergunta e valem na partida.
    Uma pergunta inativa não aparece para ser adicionada a novos quizzes,
    mas continua nos quizzes em que já está.
    """

    class Dificuldade(models.TextChoices):
        FACIL = "facil", "Fácil"
        MEDIO = "medio", "Médio"
        DIFICIL = "dificil", "Difícil"

    class Letra(models.TextChoices):
        A = "A", "A"
        B = "B", "B"
        C = "C", "C"
        D = "D", "D"

    dono = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="perguntas")
    texto = models.CharField("texto da pergunta", max_length=300)
    alternativa_a = models.CharField(max_length=150)
    alternativa_b = models.CharField(max_length=150)
    alternativa_c = models.CharField(max_length=150)
    alternativa_d = models.CharField(max_length=150)
    resposta_correta = models.CharField(max_length=1, choices=Letra.choices)
    categoria = models.ForeignKey(
        Categoria, on_delete=models.SET_NULL, null=True, blank=True, related_name="perguntas"
    )
    dificuldade = models.CharField(max_length=10, choices=Dificuldade.choices, default=Dificuldade.MEDIO)
    tempo_limite = models.PositiveSmallIntegerField(
        "tempo limite (segundos)",
        default=TEMPO_PADRAO,
        validators=[MinValueValidator(TEMPO_MINIMO), MaxValueValidator(TEMPO_MAXIMO)],
    )
    pontuacao_maxima = models.PositiveIntegerField(
        "pontuação máxima",
        default=PONTUACAO_PADRAO,
        validators=[MinValueValidator(PONTUACAO_MINIMA), MaxValueValidator(PONTUACAO_MAXIMA)],
    )
    imagem = models.ImageField(upload_to=caminho_imagem_pergunta, blank=True)
    ativa = models.BooleanField(default=True)
    # False quando a pergunta é uma cópia exclusiva de um quiz (quiz duplicado ou pergunta
    # editada pelo lápis dentro do quiz). Essas não aparecem no Banco de Perguntas.
    no_banco = models.BooleanField(default=True)
    criada_em = models.DateTimeField(auto_now_add=True)
    atualizada_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-atualizada_em", "-id"]

    @property
    def alternativas(self):
        return {
            "A": self.alternativa_a,
            "B": self.alternativa_b,
            "C": self.alternativa_c,
            "D": self.alternativa_d,
        }

    def copiar(self, **alteracoes):
        """Cria uma cópia exclusiva de quiz (fora do banco), com a imagem duplicada."""
        copia = Pergunta(
            dono_id=self.dono_id,
            texto=self.texto,
            alternativa_a=self.alternativa_a,
            alternativa_b=self.alternativa_b,
            alternativa_c=self.alternativa_c,
            alternativa_d=self.alternativa_d,
            resposta_correta=self.resposta_correta,
            categoria_id=self.categoria_id,
            dificuldade=self.dificuldade,
            tempo_limite=self.tempo_limite,
            pontuacao_maxima=self.pontuacao_maxima,
            ativa=True,
            no_banco=False,
        )
        if self.imagem and "imagem" not in alteracoes:
            with self.imagem.open("rb") as arquivo:
                copia.imagem.save(os.path.basename(self.imagem.name), ContentFile(arquivo.read()), save=False)
        for campo, valor in alteracoes.items():
            setattr(copia, campo, valor)
        copia.save()
        return copia

    def excluir_com_imagem(self):
        if self.imagem:
            self.imagem.delete(save=False)
        self.delete()

    def __str__(self):
        return self.texto
