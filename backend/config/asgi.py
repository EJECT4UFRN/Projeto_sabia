"""Ponto de entrada ASGI: HTTP pelo Django e WebSocket pelo Channels.

As rotas WebSocket das partidas ao vivo entram em `websocket_urlpatterns`
na etapa da partida.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

aplicacao_django = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

websocket_urlpatterns = []

application = ProtocolTypeRouter(
    {
        "http": aplicacao_django,
        "websocket": AllowedHostsOriginValidator(URLRouter(websocket_urlpatterns)),
    }
)
