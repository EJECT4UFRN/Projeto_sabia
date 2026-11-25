from rest_framework import serializers

from .models import (
    PONTUACAO_MAXIMA,
    PONTUACAO_MINIMA,
    TEMPO_MAXIMO,
    TEMPO_MINIMO,
    Categoria,
    Pergunta,
)

TAMANHO_MAXIMO_IMAGEM = 5 * 1024 * 1024  # 5 MB
FORMATOS_IMAGEM = {"JPEG", "PNG", "WEBP", "GIF"}
CAMPOS_ALTERNATIVAS = ("alternativa_a", "alternativa_b", "alternativa_c", "alternativa_d")


def _juntar_espacos(texto):
    return " ".join((texto or "").split())


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ("id", "nome")

    def validate_nome(self, valor):
        valor = _juntar_espacos(valor)
        if not valor:
            raise serializers.ValidationError("Dê um nome para a categoria.")
        dono = self.context["request"].user
        if Categoria.objects.filter(dono=dono, nome__iexact=valor).exists():
            raise serializers.ValidationError("Você já tem uma categoria com esse nome.")
        return valor


class CategoriaDoProfessorField(serializers.PrimaryKeyRelatedField):
    """Só aceita categorias do professor logado."""

    def get_queryset(self):
        return Categoria.objects.filter(dono=self.context["request"].user)


class PerguntaSerializer(serializers.ModelSerializer):
    categoria = CategoriaDoProfessorField(allow_null=True, required=False)
    categoria_nome = serializers.CharField(source="categoria.nome", read_only=True, default=None)
    tempo_limite = serializers.IntegerField(
        required=False,
        min_value=TEMPO_MINIMO,
        max_value=TEMPO_MAXIMO,
        error_messages={
            "min_value": f"O tempo mínimo é {TEMPO_MINIMO} segundos.",
            "max_value": f"O tempo máximo é {TEMPO_MAXIMO} segundos.",
        },
    )
    pontuacao_maxima = serializers.IntegerField(
        required=False,
        min_value=PONTUACAO_MINIMA,
        max_value=PONTUACAO_MAXIMA,
        error_messages={
            "min_value": f"A pontuação mínima é {PONTUACAO_MINIMA}.",
            "max_value": f"A pontuação máxima é {PONTUACAO_MAXIMA}.",
        },
    )
    imagem = serializers.ImageField(required=False, allow_null=True)
    remover_imagem = serializers.BooleanField(write_only=True, required=False, default=False)
    em_quizzes = serializers.SerializerMethodField()

    class Meta:
        model = Pergunta
        fields = (
            "id",
            "texto",
            *CAMPOS_ALTERNATIVAS,
            "resposta_correta",
            "categoria",
            "categoria_nome",
            "dificuldade",
            "tempo_limite",
            "pontuacao_maxima",
            "imagem",
            "remover_imagem",
            "ativa",
            "em_quizzes",
            "criada_em",
            "atualizada_em",
        )
        read_only_fields = ("id", "criada_em", "atualizada_em")
        extra_kwargs = {
            "texto": {"error_messages": {"blank": "Escreva o texto da pergunta."}},
            "resposta_correta": {
                "error_messages": {
                    "required": "Marque qual alternativa é a correta.",
                    "invalid_choice": "Marque qual alternativa é a correta.",
                }
            },
            **{
                campo: {"error_messages": {"blank": "Preencha esta alternativa."}}
                for campo in CAMPOS_ALTERNATIVAS
            },
        }

    def get_em_quizzes(self, pergunta):
        """Em quantos quizzes a pergunta está (se > 0, não pode ser excluída)."""
        anotado = getattr(pergunta, "em_quizzes", None)
        return anotado if anotado is not None else pergunta.usos.count()

    def validate_texto(self, valor):
        valor = _juntar_espacos(valor)
        if not valor:
            raise serializers.ValidationError("Escreva o texto da pergunta.")
        return valor

    def validate_imagem(self, arquivo):
        if arquivo is None:
            return arquivo
        if arquivo.size > TAMANHO_MAXIMO_IMAGEM:
            raise serializers.ValidationError("A imagem pode ter no máximo 5 MB.")
        formato = getattr(getattr(arquivo, "image", None), "format", None)
        if formato and formato.upper() not in FORMATOS_IMAGEM:
            raise serializers.ValidationError("Use uma imagem JPG, PNG, WEBP ou GIF.")
        return arquivo

    def validate(self, dados):
        erros = {}
        alternativas = {}
        for campo in CAMPOS_ALTERNATIVAS:
            if campo in dados:
                dados[campo] = _juntar_espacos(dados[campo])
                if not dados[campo]:
                    erros[campo] = "Preencha esta alternativa."
            alternativas[campo] = dados.get(campo, getattr(self.instance, campo, ""))

        # Duas alternativas iguais confundem o estudante e tornam a resposta ambígua.
        # O erro vai para a alternativa que a pessoa acabou de mexer (numa edição parcial)
        # ou, se as duas foram enviadas, para a que vem depois.
        vistos = {}
        for campo, texto in alternativas.items():
            chave = texto.casefold()
            if not chave:
                continue
            anterior = vistos.get(chave)
            if anterior is None:
                vistos[chave] = campo
                continue
            culpado = anterior if (anterior in dados and campo not in dados) else campo
            erros.setdefault(culpado, "Esta alternativa repete outra. Cada opção precisa ser diferente.")

        if erros:
            raise serializers.ValidationError(erros)
        return dados

    def _aplicar_imagem(self, pergunta, dados):
        remover = dados.pop("remover_imagem", False)
        nova = dados.pop("imagem", None)
        if (remover or nova) and pergunta.imagem:
            pergunta.imagem.delete(save=False)
        if nova:
            pergunta.imagem = nova

    def create(self, dados):
        imagem = dados.pop("imagem", None)
        dados.pop("remover_imagem", None)
        pergunta = Pergunta(dono=self.context["request"].user, **dados)
        if imagem:
            pergunta.imagem = imagem
        pergunta.save()
        return pergunta

    def update(self, pergunta, dados):
        self._aplicar_imagem(pergunta, dados)
        for campo, valor in dados.items():
            setattr(pergunta, campo, valor)
        pergunta.save()
        return pergunta
