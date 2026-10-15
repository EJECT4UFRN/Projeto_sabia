from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Usuario
from .serializers import (
    CadastroSerializer,
    EntrarSerializer,
    EsqueciSenhaSerializer,
    RedefinirSenhaSerializer,
    UsuarioSerializer,
)


def _resposta_com_tokens(usuario, codigo=status.HTTP_200_OK):
    refresh = RefreshToken.for_user(usuario)
    return Response(
        {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "usuario": UsuarioSerializer(usuario).data,
        },
        status=codigo,
    )


class CadastroView(APIView):
    """Cria a conta e já devolve os tokens ("Criar conta e jogar")."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "cadastro"

    def post(self, request):
        serializer = CadastroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        return _resposta_com_tokens(usuario, status.HTTP_201_CREATED)


class EntrarView(APIView):
    """Login por nome de usuário ou e-mail."""

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "entrar"

    def post(self, request):
        serializer = EntrarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return _resposta_com_tokens(serializer.validated_data["usuario"])


class SairView(APIView):
    """Invalida o refresh token para que a sessão não possa ser renovada."""

    def post(self, request):
        try:
            RefreshToken(request.data.get("refresh", "")).blacklist()
        except TokenError:
            pass  # token já inválido ou expirado: para quem está saindo, o resultado é o mesmo
        return Response(status=status.HTTP_204_NO_CONTENT)


class EuView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UsuarioSerializer(request.user).data)


class EsqueciSenhaView(APIView):
    """Envia o link de redefinição para o e-mail da conta.

    A resposta é sempre a mesma, exista a conta ou não, para não revelar quem está cadastrado.
    Contas sem e-mail não têm como receber o link.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "recuperar_senha"

    MENSAGEM = (
        "Se existir uma conta com esse usuário ou e-mail e ela tiver um e-mail cadastrado, "
        "enviamos um link para redefinir a senha."
    )

    def post(self, request):
        serializer = EsqueciSenhaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = Usuario.objects.buscar_por_login(serializer.validated_data["login"], is_active=True)
        if usuario and usuario.email:
            self._enviar_link(usuario)
        return Response({"detalhe": self.MENSAGEM})

    def _enviar_link(self, usuario):
        uid = urlsafe_base64_encode(force_bytes(usuario.pk))
        token = default_token_generator.make_token(usuario)
        link = f"{settings.FRONTEND_URL}/redefinir-senha/{uid}/{token}"
        send_mail(
            subject="Sabiá: redefinição de senha",
            message=(
                f"Olá, {usuario.username}!\n\n"
                "Recebemos um pedido para redefinir a senha da sua conta no Sabiá.\n"
                f"Para criar uma senha nova, acesse o link abaixo (válido por 1 hora):\n\n{link}\n\n"
                "Se não foi você, pode ignorar este e-mail: sua senha continua a mesma."
            ),
            from_email=None,
            recipient_list=[usuario.email],
        )


class RedefinirSenhaView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "recuperar_senha"

    def post(self, request):
        serializer = RedefinirSenhaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.validated_data["usuario"]
        usuario.set_password(serializer.validated_data["nova_senha"])
        usuario.save(update_fields=["password"])
        return Response({"detalhe": "Senha alterada. Você já pode entrar com a nova senha."})
