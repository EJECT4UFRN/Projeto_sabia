from django.contrib.auth.models import AbstractUser
from django.db import models


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
        # Cores das amostras da tela de perfil, nomeadas pelos tokens do Figma.
        LARANJA_SINERGY = "laranja_sinergy", "Laranja Sinergy"
        LARANJA = "laranja", "Laranja"
        AMARELO = "amarelo", "Amarelo"
        AZUL_CLARO = "azul_claro", "Azul claro"
        AZUL = "azul", "Azul"
        AZUL_ESCURO = "azul_escuro", "Azul escuro"

    email = models.EmailField("e-mail", blank=True)
    perfil = models.CharField(max_length=20, choices=Perfil.choices, default=Perfil.ESTUDANTE)
    cor_avatar = models.CharField(
        "cor do avatar", max_length=20, choices=CorAvatar.choices, default=CorAvatar.LARANJA_SINERGY
    )
    sobre_mim = models.TextField("sobre mim", blank=True)

    class Meta:
        verbose_name = "usuário"
        verbose_name_plural = "usuários"

    @property
    def eh_professor(self):
        return self.perfil == self.Perfil.PROFESSOR

    @property
    def iniciais(self):
        """Duas letras exibidas no avatar (ex.: "AT" para Állex Thierry)."""
        nome = self.get_full_name().strip() or self.username
        partes = nome.split()
        if len(partes) >= 2:
            return (partes[0][0] + partes[-1][0]).upper()
        return nome[:2].upper()

    def __str__(self):
        return self.username
