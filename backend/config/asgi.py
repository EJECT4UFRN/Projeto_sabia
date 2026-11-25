"""Ponto de entrada ASGI: HTTP pelo Django e WebSocket (partidas ao vivo) pelo Channels."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

aplicacao_django = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import OriginValidator  # noqa: E402
from django.conf import settings  # noqa: E402

from partidas.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": aplicacao_django,
        # Aceita os endereços do próprio backend e os do frontend, que fica em outro domínio.
        "websocket": OriginValidator(
            URLRouter(websocket_urlpatterns), settings.ALLOWED_HOSTS + settings.CORS_ALLOWED_ORIGINS
        ),
    }
)
