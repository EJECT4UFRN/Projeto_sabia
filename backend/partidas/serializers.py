from rest_framework import serializers

from quizzes.models import Quiz

from .models import LIMITE_MAXIMO, LIMITE_MINIMO, LIMITE_PADRAO, Partida


class AbrirSalaSerializer(serializers.Serializer):
    quiz = serializers.PrimaryKeyRelatedField(queryset=Quiz.objects.none())
    limite_participantes = serializers.IntegerField(
        required=False,
        default=LIMITE_PADRAO,
        min_value=LIMITE_MINIMO,
        max_value=LIMITE_MAXIMO,
        error_messages={
            "min_value": f"O limite mínimo é {LIMITE_MINIMO} participante.",
            "max_value": f"O limite máximo é {LIMITE_MAXIMO} participantes.",
            "invalid": "Use um número inteiro.",
        },
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["quiz"].queryset = Quiz.objects.filter(dono=self.context["request"].user)

    def validate_quiz(self, quiz):
        if not quiz.pode_iniciar:
            raise serializers.ValidationError(
                "Publique o quiz (com ao menos uma pergunta) para iniciar uma partida."
            )
        return quiz


class PartidaSerializer(serializers.ModelSerializer):
    total_perguntas = serializers.SerializerMethodField()

    class Meta:
        model = Partida
        fields = (
            "id",
            "pin",
            "titulo",
            "disciplina",
            "estado",
            "limite_participantes",
            "total_perguntas",
            "quiz",
        )

    def get_total_perguntas(self, partida):
        return len(partida.perguntas)


class EntrarSerializer(serializers.Serializer):
    pin = serializers.CharField(error_messages={"blank": "Digite os 6 números do PIN."})
    apelido = serializers.CharField(
        max_length=30,
        error_messages={
            "blank": "Escolha um apelido para entrar.",
            "max_length": "O apelido pode ter até 30 caracteres.",
        },
    )
