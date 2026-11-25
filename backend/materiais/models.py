import os
import re
from urllib.parse import parse_qs, urlparse

from django.conf import settings
from django.db import models

from escola.models import Disciplina, Turma

# YouTube: watch?v=, youtu.be/, /embed/, /shorts/ e /live/.
_ID_YOUTUBE = re.compile(r"^[\w-]{11}$")


def id_do_youtube(url):
    """Devolve o id do vídeo quando o link é do YouTube, ou "" quando não é."""
    try:
        partes = urlparse(url or "")
    except ValueError:
        return ""
    host = (partes.hostname or "").lower().removeprefix("www.").removeprefix("m.")
    candidato = ""
    if host == "youtu.be":
        candidato = partes.path.strip("/").split("/")[0]
    elif host in {"youtube.com", "music.youtube.com", "youtube-nocookie.com"}:
        if partes.path == "/watch":
            candidato = parse_qs(partes.query).get("v", [""])[0]
        else:
            pedacos = partes.path.strip("/").split("/")
            if len(pedacos) >= 2 and pedacos[0] in {"embed", "shorts", "live", "v"}:
                candidato = pedacos[1]
    return candidato if _ID_YOUTUBE.match(candidato) else ""


def caminho_arquivo(material, nome_arquivo):
    return f"materiais/{material.dono_id}/arquivos/{nome_arquivo}"


def caminho_capa(material, nome_arquivo):
    return f"materiais/{material.dono_id}/capas/{nome_arquivo}"


class Material(models.Model):
    """Conteúdo de estudo do professor: vídeo (link), documento (arquivo) ou artigo (link).

    Regras confirmadas:
    - o material fica disponível para as turmas marcadas e/ou "Público" (qualquer pessoa, até sem
      conta). Rascunho não aparece para ninguém além do professor;
    - documento aceita PDF, DOC e DOCX de até 20 MB; capa é opcional (JPG, PNG ou WEBP);
    - vídeo do YouTube toca dentro do Sabiá e, sem capa, usa a imagem do próprio vídeo;
    - visualização conta 1 por estudante; "concluído" só quando o professor permite;
    - "Tirar do ar" volta o material para rascunho; excluir apaga também arquivo e capa.
    """

    class Tipo(models.TextChoices):
        VIDEO = "video", "Vídeo"
        DOCUMENTO = "documento", "PDF / Documento"
        ARTIGO = "artigo", "Link / Artigo"

    class Status(models.TextChoices):
        RASCUNHO = "rascunho", "Rascunho"
        PUBLICADO = "publicado", "Publicado"

    dono = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="materiais")
    titulo = models.CharField("título", max_length=120)
    descricao = models.CharField("descrição", max_length=300, blank=True)
    # PROTECT: disciplina com materiais não pode ser excluída.
    disciplina = models.ForeignKey(Disciplina, on_delete=models.PROTECT, related_name="materiais")
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    arquivo = models.FileField(upload_to=caminho_arquivo, blank=True)
    url = models.URLField(max_length=500, blank=True)
    duracao_segundos = models.PositiveIntegerField("duração do vídeo (segundos)", null=True, blank=True)
    tempo_leitura = models.PositiveSmallIntegerField("tempo de leitura (minutos)", null=True, blank=True)
    capa = models.ImageField(upload_to=caminho_capa, blank=True)
    publico = models.BooleanField("público (qualquer pessoa)", default=False)
    turmas = models.ManyToManyField(Turma, related_name="materiais", blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.RASCUNHO)
    permitir_concluir = models.BooleanField("estudantes podem marcar como concluído", default=False)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-criado_em", "-id"]
        verbose_name_plural = "materiais"

    def __str__(self):
        return self.titulo

    @property
    def youtube_id(self):
        return id_do_youtube(self.url) if self.tipo == self.Tipo.VIDEO else ""

    @property
    def extensao(self):
        return os.path.splitext(self.arquivo.name)[1].lstrip(".").upper() if self.arquivo else ""

    def apagar_arquivos(self):
        for campo in (self.arquivo, self.capa):
            if campo:
                campo.delete(save=False)


class Visualizacao(models.Model):
    """Primeira vez que um estudante logado abriu o material (conta 1 por estudante)."""

    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name="visualizacoes")
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint("material", "usuario", name="visualizacao_unica")]


class Conclusao(models.Model):
    """Estudante marcou o material como concluído."""

    material = models.ForeignKey(Material, on_delete=models.CASCADE, related_name="conclusoes")
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint("material", "usuario", name="conclusao_unica")]
