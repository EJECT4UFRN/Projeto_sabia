from django.db import transaction
from rest_framework import serializers

from perguntas.models import (
    PONTUACAO_MAXIMA,
    PONTUACAO_MINIMA,
    TEMPO_MAXIMO,
    TEMPO_MINIMO,
    Pergunta,
)
from perguntas.serializers import PerguntaSerializer

from .models import Quiz, QuizPergunta

TITULO_VAZIO = "Dê um título para o quiz."


def _juntar_espacos(texto):
    return " ".join((texto or "").split())


class QuizResumoSerializer(serializers.ModelSerializer):
    """Card da lista "Meus jogos"."""

    perguntas_total = serializers.IntegerField(read_only=True)
    partidas_realizadas = serializers.IntegerField(read_only=True)

    class Meta:
        model = Quiz
        fields = (
            "id",
            "titulo",
            "disciplina",
            "turma",
            "dificuldade",
            "status",
            "favorito",
            "perguntas_total",
            "partidas_realizadas",
            "atualizado_em",
        )


class PerguntaDoQuizSerializer(PerguntaSerializer):
    class Meta(PerguntaSerializer.Meta):
        fields = tuple(c for c in PerguntaSerializer.Meta.fields if c != "remover_imagem") + ("no_banco",)


class QuizSerializer(serializers.ModelSerializer):
    """Editor do quiz. `perguntas_ids` (escrita) define as perguntas e a ordem;
    `perguntas` (leitura) devolve as perguntas completas na ordem."""

    perguntas_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False, allow_empty=True
    )
    perguntas = serializers.SerializerMethodField()
    perguntas_total = serializers.SerializerMethodField()
    partidas_realizadas = serializers.SerializerMethodField()
    pode_iniciar = serializers.BooleanField(read_only=True)
    tempo_padrao = serializers.IntegerField(
        required=False,
        min_value=TEMPO_MINIMO,
        max_value=TEMPO_MAXIMO,
        error_messages={
            "min_value": f"O tempo mínimo é {TEMPO_MINIMO} segundos.",
            "max_value": f"O tempo máximo é {TEMPO_MAXIMO} segundos.",
        },
    )
    pontuacao_padrao = serializers.IntegerField(
        required=False,
        min_value=PONTUACAO_MINIMA,
        max_value=PONTUACAO_MAXIMA,
        error_messages={
            "min_value": f"A pontuação mínima é {PONTUACAO_MINIMA}.",
            "max_value": f"A pontuação máxima é {PONTUACAO_MAXIMA}.",
        },
    )

    class Meta:
        model = Quiz
        fields = (
            "id",
            "titulo",
            "descricao",
            "disciplina",
            "turma",
            "dificuldade",
            "tempo_padrao",
            "pontuacao_padrao",
            "embaralhar_perguntas",
            "embaralhar_respostas",
            "status",
            "favorito",
            "perguntas_ids",
            "perguntas",
            "perguntas_total",
            "partidas_realizadas",
            "pode_iniciar",
            "criado_em",
            "atualizado_em",
        )
        read_only_fields = ("id", "criado_em", "atualizado_em")
        extra_kwargs = {
            "titulo": {"error_messages": {"blank": TITULO_VAZIO, "required": TITULO_VAZIO}},
        }

    def get_perguntas(self, quiz):
        itens = quiz.itens.select_related("pergunta__categoria")
        return PerguntaDoQuizSerializer([i.pergunta for i in itens], many=True, context=self.context).data

    def get_perguntas_total(self, quiz):
        return quiz.itens.count()

    def get_partidas_realizadas(self, quiz):
        anotado = getattr(quiz, "partidas_realizadas", None)
        return anotado if anotado is not None else quiz.partidas.filter(estado="encerrada").count()

    def validate_titulo(self, valor):
        valor = _juntar_espacos(valor)
        if not valor:
            raise serializers.ValidationError("Dê um título para o quiz.")
        return valor

    def validate_disciplina(self, valor):
        return _juntar_espacos(valor)

    def validate_turma(self, valor):
        return _juntar_espacos(valor)

    def validate_descricao(self, valor):
        return (valor or "").strip()

    def validate_perguntas_ids(self, ids):
        if len(set(ids)) != len(ids):
            raise serializers.ValidationError("A mesma pergunta foi adicionada mais de uma vez.")
        dono = self.context["request"].user
        atuais = set(self.instance.itens.values_list("pergunta_id", flat=True)) if self.instance else set()
        perguntas = {p.id: p for p in Pergunta.objects.filter(dono=dono, id__in=ids)}
        for id_ in ids:
            pergunta = perguntas.get(id_)
            ja_esta = id_ in atuais
            # Cópias exclusivas só valem no quiz delas; perguntas inativas não entram em quiz novo.
            if pergunta is None or (not pergunta.no_banco and not ja_esta):
                raise serializers.ValidationError("Uma das perguntas escolhidas não existe mais.")
            if not pergunta.ativa and not ja_esta:
                raise serializers.ValidationError(
                    "Uma das perguntas escolhidas está inativa. Ative-a no banco para adicionar."
                )
        return ids

    def validate(self, dados):
        status = dados.get("status", getattr(self.instance, "status", Quiz.Status.RASCUNHO))
        if "perguntas_ids" in dados:
            total = len(dados["perguntas_ids"])
        else:
            total = self.instance.itens.count() if self.instance else 0
        if status == Quiz.Status.PUBLICADO and total == 0:
            campo = "status" if "status" in dados else "perguntas_ids"
            raise serializers.ValidationError({campo: "Adicione ao menos uma pergunta para publicar o quiz."})
        return dados

    def _definir_perguntas(self, quiz, ids):
        anteriores = set(quiz.itens.values_list("pergunta_id", flat=True))
        removidas_exclusivas = list(quiz.perguntas_exclusivas().exclude(id__in=ids))
        quiz.itens.all().delete()
        QuizPergunta.objects.bulk_create(
            QuizPergunta(quiz=quiz, pergunta_id=id_, ordem=posicao) for posicao, id_ in enumerate(ids, 1)
        )
        # Cópia exclusiva tirada do quiz não tem mais onde aparecer: é apagada.
        for pergunta in removidas_exclusivas:
            if pergunta.id in anteriores:
                pergunta.excluir_com_imagem()

    @transaction.atomic
    def create(self, dados):
        ids = dados.pop("perguntas_ids", [])
        quiz = Quiz.objects.create(dono=self.context["request"].user, **dados)
        self._definir_perguntas(quiz, ids)
        return quiz

    @transaction.atomic
    def update(self, quiz, dados):
        ids = dados.pop("perguntas_ids", None)
        for campo, valor in dados.items():
            setattr(quiz, campo, valor)
        quiz.save()
        if ids is not None:
            self._definir_perguntas(quiz, ids)
        return quiz
