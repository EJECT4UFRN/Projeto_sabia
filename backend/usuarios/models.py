import re

from django.contrib.auth.models import AbstractUser, UserManager
from django.core.validators import RegexValidator
from django.db import models


def normalizar_login(texto):
    """Tira espaços das pontas e junta espaços repetidos ("  Ryan   Guilherme " → "Ryan Guilherme")."""
    return re.sub(r"\s+", " ", texto or "").strip()


class ValidadorNomeDeUsuario(RegexValidator):
    # Como o padrão do Django, mas aceitando espaço entre as palavras (ex.: "Ryan Guilherme").
    regex = r"^[\w.@+\- ]+\Z"
    message = "Use apenas letras, números, espaços e os caracteres @ . + - _"
    flags = 0


class GerenciadorUsuario(UserManager):
    def buscar_por_login(self, login, **filtros):
        """Encontra a conta pelo nome de usuário ou pelo e-mail, sem diferenciar maiúsculas."""
        login = normalizar_login(login)
        if not login:
            return None
        if "@" in login:
            por_email = self.filter(email__iexact=login, **filtros).exclude(email="").first()
            if por_email:
                return por_email
        return self.filter(username__iexact=login, **filtros).first()


class Usuario(AbstractUser):
    """Conta do Sabiá.

    Há dois perfis: o estudante joga e acessa materiais; o professor é também
    o administrador e só enxerga os quizzes, perguntas e materiais que criou.
    Quem joga como convidado (só com apelido) não tem conta.
    """

    class Perfil(models.TextChoices):
        ESTUDANTE = "estudante", "Estudante"
        PROFESSOR = "professor", "Professor"

    class CorAvatar(models.TextChoices):
        # As 6 amostras da tela de perfil do mockup.
        AMARELO = "amarelo", "Amarelo"
        LARANJA = "laranja", "Laranja"
        AZUL = "azul", "Azul"
        VERDE = "verde", "Verde"
        VERMELHO = "vermelho", "Vermelho"
        ROXO = "roxo", "Roxo"

    username_validator = ValidadorNomeDeUsuario()

    username = models.CharField(
        "nome de usuário",
        max_length=150,
        unique=True,
        validators=[username_validator],
        error_messages={"unique": "Este nome de usuário já está em uso."},
    )
    email = models.EmailField("e-mail", blank=True)
    perfil = models.CharField(max_length=20, choices=Perfil.choices, default=Perfil.ESTUDANTE)
    cor_avatar = models.CharField(
        "cor do avatar", max_length=20, choices=CorAvatar.choices, default=CorAvatar.AMARELO
    )
    # Nome mostrado no perfil, no histórico e sugerido como apelido nas partidas.
    # Em branco, vale o nome de usuário (que é o login e não muda).
    nome_exibicao = models.CharField("nome de exibição", max_length=60, blank=True)
    sobre_mim = models.TextField("sobre mim", max_length=200, blank=True)

    objects = GerenciadorUsuario()

    class Meta:
        verbose_name = "usuário"
        verbose_name_plural = "usuários"

    @property
    def eh_professor(self):
        return self.perfil == self.Perfil.PROFESSOR

    @property
    def nome(self):
        return self.nome_exibicao.strip() or self.get_full_name().strip() or self.username

    @property
    def iniciais(self):
        """Duas letras do avatar: "ÁT" para "Állex Thierry" e também para "ÁllexThierry"."""
        partes = self.nome.split()
        if len(partes) >= 2:
            return (partes[0][0] + partes[-1][0]).upper()
        maiusculas = [letra for letra in self.nome if letra.isupper()]
        if len(maiusculas) >= 2:
            return maiusculas[0] + maiusculas[-1]
        return self.nome[:2].upper()

    def __str__(self):
        return self.username
