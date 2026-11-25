from django.contrib.auth import password_validation
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as ErroDeValidacaoDjango
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import serializers

from .models import Usuario, normalizar_login


class UsuarioSerializer(serializers.ModelSerializer):
    """Dados do usuário logado devolvidos ao frontend."""

    nome = serializers.CharField(read_only=True)
    iniciais = serializers.CharField(read_only=True)

    class Meta:
        model = Usuario
        fields = (
            "id",
            "username",
            "nome",
            "nome_exibicao",
            "email",
            "perfil",
            "cor_avatar",
            "sobre_mim",
            "iniciais",
            "date_joined",
        )
        read_only_fields = fields


class PerfilSerializer(serializers.ModelSerializer):
    """Edição do próprio perfil. Trocar o e-mail pede a senha atual."""

    senha_atual = serializers.CharField(
        write_only=True, required=False, allow_blank=True, trim_whitespace=False
    )

    class Meta:
        model = Usuario
        fields = ("nome_exibicao", "email", "cor_avatar", "sobre_mim", "senha_atual")
        extra_kwargs = {
            "cor_avatar": {"error_messages": {"invalid_choice": "Escolha uma das cores."}},
            "sobre_mim": {"error_messages": {"max_length": "Use no máximo 200 caracteres."}},
            "nome_exibicao": {"error_messages": {"max_length": "Use no máximo 60 caracteres."}},
            "email": {"error_messages": {"invalid": "Digite um e-mail válido."}},
        }

    def validate_nome_exibicao(self, valor):
        return " ".join((valor or "").split())

    def validate_sobre_mim(self, valor):
        return (valor or "").strip()

    def validate_email(self, valor):
        valor = (valor or "").strip().lower()
        if valor and Usuario.objects.filter(email__iexact=valor).exclude(pk=self.instance.pk).exists():
            raise serializers.ValidationError("Este e-mail já está em uso por outra conta.")
        return valor

    def validate(self, dados):
        senha = dados.pop("senha_atual", "")
        trocou_email = "email" in dados and dados["email"] != (self.instance.email or "").lower()
        if trocou_email:
            if not senha:
                raise serializers.ValidationError(
                    {"senha_atual": "Digite sua senha atual para trocar o e-mail."}
                )
            if not self.instance.check_password(senha):
                raise serializers.ValidationError({"senha_atual": "Senha atual incorreta."})
        return dados


class _ConfirmacaoDeSenhaMixin:
    """Valida senha + confirmação com as regras de senha do Django."""

    campo_senha = "senha"

    def _validar_senhas(self, dados, usuario):
        senha = dados[self.campo_senha]
        if senha != dados["confirmar_senha"]:
            raise serializers.ValidationError({"confirmar_senha": "As senhas não coincidem."})
        try:
            password_validation.validate_password(senha, usuario)
        except ErroDeValidacaoDjango as erro:
            raise serializers.ValidationError({self.campo_senha: list(erro.messages)}) from erro


class AlterarSenhaSerializer(_ConfirmacaoDeSenhaMixin, serializers.Serializer):
    senha_atual = serializers.CharField(trim_whitespace=False)
    senha = serializers.CharField(trim_whitespace=False)
    confirmar_senha = serializers.CharField(trim_whitespace=False)

    def validate(self, dados):
        usuario = self.context["request"].user
        if not usuario.check_password(dados["senha_atual"]):
            raise serializers.ValidationError({"senha_atual": "Senha atual incorreta."})
        self._validar_senhas(dados, usuario)
        return dados


class CadastroSerializer(_ConfirmacaoDeSenhaMixin, serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    senha = serializers.CharField(write_only=True, trim_whitespace=False)
    confirmar_senha = serializers.CharField(write_only=True, trim_whitespace=False)
    perfil = serializers.ChoiceField(choices=Usuario.Perfil.choices, default=Usuario.Perfil.ESTUDANTE)

    def validate_username(self, valor):
        valor = normalizar_login(valor)
        Usuario.username_validator(valor)
        if Usuario.objects.filter(username__iexact=valor).exists():
            raise serializers.ValidationError("Este nome de usuário já está em uso.")
        return valor

    def validate_email(self, valor):
        valor = (valor or "").strip().lower()
        # O e-mail é opcional, mas quando informado precisa ser único:
        # é por ele que a pessoa recupera a senha.
        if valor and Usuario.objects.filter(email__iexact=valor).exists():
            raise serializers.ValidationError("Já existe uma conta com este e-mail.")
        return valor

    def validate(self, dados):
        provisorio = Usuario(username=dados["username"], email=dados.get("email", ""))
        self._validar_senhas(dados, provisorio)
        return dados

    def create(self, dados):
        return Usuario.objects.create_user(
            username=dados["username"],
            email=dados.get("email", ""),
            password=dados["senha"],
            perfil=dados["perfil"],
        )


class EntrarSerializer(serializers.Serializer):
    login = serializers.CharField()
    senha = serializers.CharField(trim_whitespace=False)

    MENSAGEM_INVALIDO = "Usuário, e-mail ou senha incorretos."

    def validate(self, dados):
        usuario = Usuario.objects.buscar_por_login(dados["login"])
        # Mesma mensagem para usuário inexistente e senha errada, para não revelar quais contas existem.
        if usuario is None or not usuario.check_password(dados["senha"]) or not usuario.is_active:
            raise serializers.ValidationError(self.MENSAGEM_INVALIDO)
        dados["usuario"] = usuario
        return dados


class EsqueciSenhaSerializer(serializers.Serializer):
    login = serializers.CharField()


class RedefinirSenhaSerializer(_ConfirmacaoDeSenhaMixin, serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    nova_senha = serializers.CharField(write_only=True, trim_whitespace=False)
    confirmar_senha = serializers.CharField(write_only=True, trim_whitespace=False)

    campo_senha = "nova_senha"
    MENSAGEM_LINK_INVALIDO = "Este link de redefinição é inválido ou expirou. Peça um novo."

    def validate(self, dados):
        try:
            usuario = Usuario.objects.get(pk=force_str(urlsafe_base64_decode(dados["uid"])))
        except (TypeError, ValueError, OverflowError, Usuario.DoesNotExist):
            usuario = None
        if usuario is None or not default_token_generator.check_token(usuario, dados["token"]):
            raise serializers.ValidationError(self.MENSAGEM_LINK_INVALIDO)
        self._validar_senhas(dados, usuario)
        dados["usuario"] = usuario
        return dados
