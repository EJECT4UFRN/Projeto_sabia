from django.urls import re_path

from .consumers import PartidaConsumer

websocket_urlpatterns = [
    re_path(r"^ws/partidas/(?P<pin>\d{6})/$", PartidaConsumer.as_asgi()),
]
