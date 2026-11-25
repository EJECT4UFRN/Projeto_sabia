from rest_framework import serializers

from .models import Disciplina, Turma, juntar_espacos


class NomeUnicoMixin:
    """Valida o nome (obrigatório, sem repetir entre os do mesmo professor)."""

    mensagem_vazio = "Digite um nome."
    mensagem_repetido = "Você já tem um item com esse nome."

    def validate_nome(self, valor):
        valor = juntar_espacos(valor)
        if not valor:
            raise serializers.ValidationError(self.mensagem_vazio)
        repetidos = self.Meta.model.objects.filter(dono=self.context["request"].user, chave=valor.casefold())
        if self.instance:
            repetidos = repetidos.exclude(pk=self.instance.pk)
        if repetidos.exists():
            raise serializers.ValidationError(self.mensagem_repetido)
        return valor

    def create(self, dados):
        return self.Meta.model.objects.create(dono=self.context["request"].user, **dados)


class DisciplinaSerializer(NomeUnicoMixin, serializers.ModelSerializer):
    mensagem_vazio = "Digite o nome da disciplina."
    mensagem_repetido = "Você já cadastrou essa disciplina."

    class Meta:
        model = Disciplina
        fields = ("id", "nome")
        extra_kwargs = {"nome": {"error_messages": {"blank": "Digite o nome da disciplina."}}}


class AlunoSerializer(serializers.Serializer):
    """Estudante como aparece na turma e na busca do professor."""

    id = serializers.IntegerField()
    nome = serializers.CharField()
    username = serializers.CharField()
    iniciais = serializers.CharField()
    cor_avatar = serializers.CharField()


class TurmaSerializer(NomeUnicoMixin, serializers.ModelSerializer):
    mensagem_vazio = "Digite o nome da turma."
    mensagem_repetido = "Você já tem uma turma com esse nome."

    alunos_total = serializers.SerializerMethodField()

    class Meta:
        model = Turma
        fields = ("id", "nome", "codigo", "alunos_total")
        read_only_fields = ("codigo",)
        extra_kwargs = {"nome": {"error_messages": {"blank": "Digite o nome da turma."}}}

    def get_alunos_total(self, turma):
        anotado = getattr(turma, "alunos_total", None)
        return anotado if anotado is not None else turma.alunos.count()


class TurmaDetalheSerializer(TurmaSerializer):
    alunos = serializers.SerializerMethodField()

    class Meta(TurmaSerializer.Meta):
        fields = (*TurmaSerializer.Meta.fields, "alunos")

    def get_alunos(self, turma):
        alunos = sorted(turma.alunos.all(), key=lambda aluno: aluno.nome.casefold())
        return AlunoSerializer(alunos, many=True).data


class MinhaTurmaSerializer(serializers.ModelSerializer):
    """Turma do ponto de vista do estudante (no perfil)."""

    professor = serializers.CharField(source="dono.nome")

    class Meta:
        model = Turma
        fields = ("id", "nome", "professor")
