import os
import re

from PIL import Image
from rest_framework import serializers

from escola.models import Disciplina, Turma, juntar_espacos

from .models import Material

TAMANHO_MAXIMO_ARQUIVO = 20 * 1024 * 1024  # 20 MB
TAMANHO_MAXIMO_CAPA = 5 * 1024 * 1024  # 5 MB
EXTENSOES_DOCUMENTO = {".pdf", ".doc", ".docx"}
FORMATOS_CAPA = {"JPEG", "PNG", "WEBP"}
TEMPO_LEITURA_MAXIMO = 300
_DURACAO = re.compile(r"^(?:(\d{1,2}):)?(\d{1,3}):([0-5]\d)$")


def ler_duracao(texto):
    """ "08:30" → 510; "1:02:05" → 3725. Devolve None para texto vazio."""
    texto = "".join((texto or "").split())
    if not texto:
        return None
    encontrado = _DURACAO.match(texto)
    if not encontrado:
        raise serializers.ValidationError("Use o formato mm:ss (ex.: 08:30).")
    horas, minutos, segundos = (int(parte or 0) for parte in encontrado.groups())
    total = horas * 3600 + minutos * 60 + segundos
    if total == 0:
        raise serializers.ValidationError("A duração precisa ser maior que zero.")
    return total


def escrever_duracao(segundos):
    if not segundos:
        return ""
    horas, resto = divmod(segundos, 3600)
    minutos, segundos = divmod(resto, 60)
    return f"{horas}:{minutos:02d}:{segundos:02d}" if horas else f"{minutos:02d}:{segundos:02d}"


def endereco(request, campo):
    if not campo:
        return None
    return request.build_absolute_uri(campo.url) if request else campo.url


def capa_url(material, request):
    if material.capa:
        return endereco(request, material.capa)
    if material.youtube_id:
        return f"https://i.ytimg.com/vi/{material.youtube_id}/hqdefault.jpg"
    return None


def tamanho_do_arquivo(material):
    try:
        return material.arquivo.size if material.arquivo else None
    except OSError:
        return None


class DisciplinaDoProfessorField(serializers.PrimaryKeyRelatedField):
    default_error_messages = {
        "required": "Escolha a disciplina.",
        "null": "Escolha a disciplina.",
        "does_not_exist": "Essa disciplina não existe mais. Escolha outra.",
        "incorrect_type": "Escolha a disciplina.",
    }

    def get_queryset(self):
        return Disciplina.objects.filter(dono=self.context["request"].user)


class MaterialSerializer(serializers.ModelSerializer):
    """Material no painel do professor. Aceita multipart (arquivo e capa).

    `turmas_ids` é o texto "1,2,3" (ou vazio) porque formulário multipart não envia lista vazia.
    """

    disciplina = DisciplinaDoProfessorField()
    disciplina_nome = serializers.CharField(source="disciplina.nome", read_only=True)
    arquivo = serializers.FileField(required=False, allow_null=True)
    capa = serializers.ImageField(required=False, allow_null=True)
    remover_capa = serializers.BooleanField(write_only=True, required=False, default=False)
    duracao = serializers.CharField(write_only=True, required=False, allow_blank=True)
    tempo_leitura = serializers.IntegerField(
        required=False,
        allow_null=True,
        min_value=1,
        max_value=TEMPO_LEITURA_MAXIMO,
        error_messages={
            "min_value": "O tempo de leitura é de pelo menos 1 minuto.",
            "max_value": f"O tempo de leitura é de no máximo {TEMPO_LEITURA_MAXIMO} minutos.",
            "invalid": "Digite os minutos em números.",
        },
    )
    url = serializers.CharField(required=False, allow_blank=True, max_length=500)
    turmas_ids = serializers.CharField(write_only=True, required=False, allow_blank=True)
    turmas = serializers.SerializerMethodField()
    capa_url = serializers.SerializerMethodField()
    arquivo_nome = serializers.SerializerMethodField()
    tamanho = serializers.SerializerMethodField()
    youtube_id = serializers.CharField(read_only=True)
    extensao = serializers.CharField(read_only=True)
    visualizacoes = serializers.SerializerMethodField()

    class Meta:
        model = Material
        fields = (
            "id",
            "titulo",
            "descricao",
            "disciplina",
            "disciplina_nome",
            "tipo",
            "arquivo",
            "arquivo_nome",
            "tamanho",
            "extensao",
            "url",
            "youtube_id",
            "duracao",
            "tempo_leitura",
            "capa",
            "remover_capa",
            "capa_url",
            "publico",
            "turmas_ids",
            "turmas",
            "status",
            "permitir_concluir",
            "visualizacoes",
            "criado_em",
            "atualizado_em",
        )
        read_only_fields = ("id", "criado_em", "atualizado_em")
        extra_kwargs = {
            "titulo": {
                "error_messages": {
                    "blank": "Dê um título para o material.",
                    "required": "Dê um título para o material.",
                }
            },
            "tipo": {
                "error_messages": {
                    "required": "Escolha o tipo de material.",
                    "invalid_choice": "Escolha o tipo de material.",
                }
            },
            "descricao": {"error_messages": {"max_length": "Use no máximo 300 caracteres."}},
        }

    # ---- leitura -------------------------------------------------------------------------------

    def to_representation(self, material):
        dados = super().to_representation(material)
        dados["duracao"] = escrever_duracao(material.duracao_segundos)
        dados["arquivo"] = endereco(self.context.get("request"), material.arquivo)
        dados.pop("capa", None)
        return dados

    def get_turmas(self, material):
        return [{"id": turma.id, "nome": turma.nome} for turma in material.turmas.all()]

    def get_capa_url(self, material):
        return capa_url(material, self.context.get("request"))

    def get_arquivo_nome(self, material):
        return os.path.basename(material.arquivo.name) if material.arquivo else ""

    def get_tamanho(self, material):
        return tamanho_do_arquivo(material)

    def get_visualizacoes(self, material):
        anotado = getattr(material, "visualizacoes_total", None)
        return anotado if anotado is not None else material.visualizacoes.count()

    # ---- validação -----------------------------------------------------------------------------

    def validate_titulo(self, valor):
        valor = juntar_espacos(valor)
        if not valor:
            raise serializers.ValidationError("Dê um título para o material.")
        return valor

    def validate_descricao(self, valor):
        return (valor or "").strip()

    def validate_duracao(self, valor):
        return ler_duracao(valor)

    def validate_url(self, valor):
        valor = (valor or "").strip()
        if valor and not re.match(r"^https?://[^\s/$.?#][^\s]*\.[^\s]+$", valor, re.IGNORECASE):
            raise serializers.ValidationError("Digite um link completo, começando com https://")
        return valor

    def validate_arquivo(self, arquivo):
        if arquivo is None:
            return None
        if os.path.splitext(arquivo.name)[1].lower() not in EXTENSOES_DOCUMENTO:
            raise serializers.ValidationError("Envie um arquivo PDF, DOC ou DOCX.")
        if arquivo.size > TAMANHO_MAXIMO_ARQUIVO:
            raise serializers.ValidationError("O arquivo pode ter no máximo 20 MB.")
        return arquivo

    def validate_capa(self, imagem):
        if imagem is None:
            return None
        if imagem.size > TAMANHO_MAXIMO_CAPA:
            raise serializers.ValidationError("A imagem pode ter no máximo 5 MB.")
        try:
            formato = Image.open(imagem).format
        except Exception:  # noqa: BLE001 - qualquer falha de leitura é imagem inválida
            formato = None
        finally:
            imagem.seek(0)
        if formato not in FORMATOS_CAPA:
            raise serializers.ValidationError("Use uma imagem JPG, PNG ou WEBP.")
        return imagem

    def validate_turmas_ids(self, texto):
        ids = [parte.strip() for parte in (texto or "").split(",") if parte.strip()]
        if not all(parte.isdigit() for parte in ids):
            raise serializers.ValidationError("Turma inválida.")
        ids = {int(parte) for parte in ids}
        turmas = list(Turma.objects.filter(dono=self.context["request"].user, id__in=ids))
        if len(turmas) != len(ids):
            raise serializers.ValidationError("Uma das turmas escolhidas não existe mais.")
        return turmas

    def _atual(self, dados, campo, padrao=None):
        if campo in dados:
            return dados[campo]
        return getattr(self.instance, campo, padrao) if self.instance else padrao

    def validate(self, dados):
        erros = {}
        tipo = self._atual(dados, "tipo")
        status = self._atual(dados, "status", Material.Status.RASCUNHO)

        if tipo == Material.Tipo.DOCUMENTO:
            tem_arquivo = dados.get("arquivo") or (
                "arquivo" not in dados and self.instance and self.instance.arquivo
            )
            if not tem_arquivo:
                erros["arquivo"] = "Envie o arquivo do material."
        elif tipo in (Material.Tipo.VIDEO, Material.Tipo.ARTIGO):
            if not self._atual(dados, "url", ""):
                erros["url"] = (
                    "Cole o link do vídeo." if tipo == Material.Tipo.VIDEO else "Cole o link do artigo."
                )

        if status == Material.Status.PUBLICADO:
            publico = self._atual(dados, "publico", False)
            if "turmas_ids" in dados:
                tem_turmas = bool(dados["turmas_ids"])
            else:
                tem_turmas = bool(self.instance and self.instance.turmas.exists())
            if not publico and not tem_turmas:
                erros["turmas_ids"] = "Escolha ao menos uma turma ou deixe o material público."

        if erros:
            raise serializers.ValidationError(erros)
        return dados

    # ---- gravação ------------------------------------------------------------------------------

    def _preparar(self, dados, material=None):
        """Ajusta os campos que dependem do tipo e troca a capa."""
        tipo = dados.get("tipo", getattr(material, "tipo", None))
        if "duracao" in dados:
            dados["duracao_segundos"] = dados.pop("duracao")
        if tipo != Material.Tipo.DOCUMENTO:
            dados["arquivo"] = None
            if material and material.arquivo:
                material.arquivo.delete(save=False)
        else:
            dados["url"] = ""
            if dados.get("arquivo") and material and material.arquivo:
                material.arquivo.delete(save=False)
            if "arquivo" in dados and not dados["arquivo"]:
                dados.pop("arquivo")
        if tipo != Material.Tipo.VIDEO:
            dados["duracao_segundos"] = None
        if tipo != Material.Tipo.ARTIGO:
            dados["tempo_leitura"] = None

        remover_capa = dados.pop("remover_capa", False)
        nova_capa = dados.pop("capa", None)
        if (remover_capa or nova_capa) and material and material.capa:
            material.capa.delete(save=False)
        if nova_capa:
            dados["capa"] = nova_capa
        elif remover_capa:
            dados["capa"] = None
        return dados.pop("turmas_ids", None)

    def create(self, dados):
        turmas = self._preparar(dados)
        dados = {
            campo: valor for campo, valor in dados.items() if valor is not None or campo == "duracao_segundos"
        }
        material = Material.objects.create(dono=self.context["request"].user, **dados)
        material.turmas.set(turmas or [])
        return material

    def update(self, material, dados):
        turmas = self._preparar(dados, material)
        for campo, valor in dados.items():
            if campo in {"arquivo", "capa"} and valor is None:
                valor = ""
            setattr(material, campo, valor)
        material.save()
        if turmas is not None:
            material.turmas.set(turmas)
        return material


class MaterialEstudoSerializer(serializers.ModelSerializer):
    """Material como o estudante (ou visitante) vê em "Continue aprendendo"."""

    disciplina = serializers.CharField(source="disciplina.nome")
    professor = serializers.CharField(source="dono.nome")
    arquivo = serializers.SerializerMethodField()
    tamanho = serializers.SerializerMethodField()
    capa_url = serializers.SerializerMethodField()
    duracao = serializers.SerializerMethodField()
    youtube_id = serializers.CharField(read_only=True)
    extensao = serializers.CharField(read_only=True)
    concluido = serializers.SerializerMethodField()

    class Meta:
        model = Material
        fields = (
            "id",
            "titulo",
            "descricao",
            "disciplina",
            "professor",
            "tipo",
            "url",
            "youtube_id",
            "arquivo",
            "tamanho",
            "extensao",
            "duracao",
            "tempo_leitura",
            "capa_url",
            "permitir_concluir",
            "concluido",
            "criado_em",
        )

    def get_arquivo(self, material):
        return endereco(self.context.get("request"), material.arquivo)

    def get_tamanho(self, material):
        return tamanho_do_arquivo(material)

    def get_capa_url(self, material):
        return capa_url(material, self.context.get("request"))

    def get_duracao(self, material):
        return escrever_duracao(material.duracao_segundos)

    def get_concluido(self, material):
        concluidos = self.context.get("concluidos")
        if concluidos is not None:
            return material.id in concluidos
        usuario = self.context["request"].user
        return bool(usuario.is_authenticated and material.conclusoes.filter(usuario=usuario).exists())
